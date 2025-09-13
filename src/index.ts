#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import {
  loadUsageEntries,
  aggregateSessionData,
  getTotalTokens,
} from "./data-loader-simple.js";
import {
  identifySessionBlocks,
  calculateBurnRate,
  projectBlockUsage,
} from "./session-blocks-simple.js";
import {
  MAX_CONTEXT_TOKENS,
  MAX_BLOCK_MINUTES,
  PROJECTED_TOKEN_LIMIT,
  USER_HOME_DIR,
} from "./constants.js";

const execPromise = promisify(exec);

// ---- Configuration ----
const REFRESH_INTERVAL_MS = 1000;
const HIGH_WATER_MARK_FILE = path.join(
  USER_HOME_DIR,
  ".claude_status_max_tokens",
);

// ---- Color and Style Helpers ----
const colors = {
  reset: "\x1b[0m",
  dir: "\x1b[38;5;117m",
  git: "\x1b[38;5;150m",
  green: "\x1b[38;5;158m",
  yellow: "\x1b[38;5;215m",
  red: "\x1b[38;5;203m",
};

const colorize = (color: keyof typeof colors, text: string) =>
  `${colors[color] || ""}${text}${colors.reset}`;

// ---- Progress Bar Helper ----
const progressBar = (pct: number, width = 20) => {
  const clampedPct = Math.max(0, Math.min(100, pct));
  const filledWidth = Math.round((clampedPct / 100) * width);
  const emptyWidth = width - filledWidth;
  return "=".repeat(filledWidth) + "-".repeat(emptyWidth);
};

// ---- Git Helper ----
async function getGitBranch(): Promise<string> {
  try {
    const { stdout } = await execPromise("git branch --show-current");
    return stdout.trim();
  } catch (error) {
    return ""; // Not a git repo or other error
  }
}

// ---- Main Logic ----
async function main() {
  let high_water_mark = 0;
  try {
    const data = await readFile(HIGH_WATER_MARK_FILE, "utf8");
    high_water_mark = parseInt(data, 10) || 0;
  } catch (error) {
    // File doesn't exist yet, which is fine
  }

  while (true) {
    try {
      // --- 1. Get Data Directly ---
      const [entries, sessions, gitBranch, pwd] = await Promise.all([
        loadUsageEntries(),
        aggregateSessionData(),
        getGitBranch(),
        execPromise("pwd"),
      ]);

      // Filter entries to match ccusage --since 20250912 behavior
      const sinceDate = new Date("2025-09-12T00:00:00.000Z");
      const filteredEntries = entries.filter(
        (entry) => entry.timestamp >= sinceDate,
      );

      const blocks = identifySessionBlocks(filteredEntries);

      // Smart project detection: try current dir, then parent dirs
      const currentPath = pwd.stdout.trim();
      let activeSession = null;

      // Try current directory and walk up the tree
      const pathParts = currentPath.split("/");
      for (let i = pathParts.length; i > 0; i--) {
        const testPath = pathParts.slice(0, i).join("/");
        const testProjName = path.basename(testPath);
        const normalizedProjName = testProjName.replace(/\./g, "-");

        const foundSession = sessions.find(
          (s) => s.sessionId && s.sessionId.includes(normalizedProjName),
        );

        if (foundSession) {
          activeSession = foundSession;
          break;
        }
      }

      const activeBlock = blocks.find((b) => b.isActive);

      // --- 2. Extract and Format Data ---
      let timeDisplay = colorize("yellow", "⏰ N/A");
      let contextDisplay = colorize("green", "🧠 N/A");
      let burnRateDisplay = "0 tokens/min";
      let burnRateStatus = colorize("green", "🟢 (Normal)");
      let usedDisplay = colorize("green", "Used: 0%");
      let projectedDisplay = colorize("green", "Projected: 0%");

      if (activeBlock) {
        const projection = projectBlockUsage(activeBlock);

        // DEBUG: Show actual token counts being used
        const blockTokens = getTotalTokens(activeBlock.tokenCounts);
        console.error(`DEBUG BLOCK TOKENS:`);
        console.error(
          `  Input: ${activeBlock.tokenCounts.inputTokens?.toLocaleString() || 0}`,
        );
        console.error(
          `  Output: ${activeBlock.tokenCounts.outputTokens?.toLocaleString() || 0}`,
        );
        console.error(
          `  Cache Creation: ${activeBlock.tokenCounts.cacheCreationInputTokens?.toLocaleString() || 0}`,
        );
        console.error(
          `  Cache Read: ${activeBlock.tokenCounts.cacheReadInputTokens?.toLocaleString() || 0}`,
        );
        console.error(`  TOTAL BLOCK: ${blockTokens.toLocaleString()}`);
        console.error(`  Entries: ${activeBlock.entries.length}`);
        console.error(
          `  Token Limit: ${PROJECTED_TOKEN_LIMIT.toLocaleString()}`,
        );
        console.error(
          `  Usage %: ${Math.round((blockTokens * 100) / PROJECTED_TOKEN_LIMIT)}%`,
        );
        if (projection) {
          console.error(
            `  Projected Total: ${projection.totalTokens.toLocaleString()}`,
          );
          console.error(
            `  Projected %: ${Math.round((projection.totalTokens * 100) / PROJECTED_TOKEN_LIMIT)}%`,
          );
        }
        const remainingMinutes = projection?.remainingMinutes ?? 0;
        const h = Math.floor(remainingMinutes / 60);
        const m = remainingMinutes % 60;
        const timePct = (remainingMinutes * 100) / MAX_BLOCK_MINUTES;
        const timeBar = progressBar(timePct);
        const timeText = `⏰ ${h}h ${m}m left`;
        timeDisplay = `${timeText} [${timeBar}]`;

        const burnRate = calculateBurnRate(activeBlock);
        const tokensPerMinute = burnRate?.tokensPerMinuteForIndicator || 0;

        // DEBUG: Show burn rate calculation details
        console.error(`DEBUG BURN RATE:`);
        console.error(
          `  Tokens/min: ${burnRate?.tokensPerMinute?.toLocaleString() || "null"}`,
        );
        console.error(
          `  Tokens/min (indicator): ${tokensPerMinute.toLocaleString()}`,
        );
        console.error(
          `  Cost/hour: $${burnRate?.costPerHour?.toFixed(2) || "null"}`,
        );

        if (tokensPerMinute > 5000)
          burnRateStatus = colorize("red", "🚨 (High)");
        else if (tokensPerMinute > 2000)
          burnRateStatus = colorize("yellow", "⚠️ (Moderate)");

        const tokensPerMin = Math.round(burnRate?.tokensPerMinute || 0);
        burnRateDisplay = `${tokensPerMin.toLocaleString()} tokens/min`;

        const blockTotalTokens = getTotalTokens(activeBlock.tokenCounts);
        const usedPct = Math.round(
          (blockTotalTokens * 100) / PROJECTED_TOKEN_LIMIT,
        );
        usedDisplay = `Used: ${usedPct}%`;

        const projectedTokens = projection?.totalTokens || 0;
        const projectedPct = Math.round(
          (projectedTokens * 100) / PROJECTED_TOKEN_LIMIT,
        );
        projectedDisplay = `Projected: ${projectedPct}%`;

        const timeColor =
          projectedPct >= 90 ? "red" : projectedPct >= 80 ? "yellow" : "green";
        const usedColor =
          usedPct >= 90 ? "red" : usedPct >= 80 ? "yellow" : "green";
        timeDisplay = colorize(timeColor, timeDisplay);
        usedDisplay = colorize(usedColor, usedDisplay);
        projectedDisplay = colorize(timeColor, projectedDisplay);

        if (blockTotalTokens > high_water_mark) {
          high_water_mark = blockTotalTokens;
          await writeFile(HIGH_WATER_MARK_FILE, high_water_mark.toString());
        }
      }

      if (activeSession) {
        // For ACP sessions, use cache_read_tokens as the real context usage
        const currentTokens =
          activeSession.cacheReadTokens || activeSession.inputTokens || 0;
        const contextPct = Math.round(
          (currentTokens * 100) / MAX_CONTEXT_TOKENS,
        );
        const contextBar = progressBar(contextPct);
        const contextText = `🧠 ${currentTokens.toLocaleString()} (${contextPct}%)`;
        contextDisplay = `${contextText} [${contextBar}]`;

        const contextColor =
          contextPct >= 80 ? "red" : contextPct >= 60 ? "yellow" : "green";
        contextDisplay = colorize(contextColor, contextDisplay);
      }

      // --- 3. Render Status Line ---
      process.stdout.write("\x1B[2J\x1B[0;0H"); // Clear screen and move to top-left

      const currentDir = pwd.stdout.trim().replace(USER_HOME_DIR, "~");
      console.log(
        `${colorize("dir", `📁 ${currentDir}`)}  ${colorize("git", gitBranch ? `🌿 ${gitBranch}` : "")}`,
      );
      console.log(`  ${timeDisplay}`);
      console.log(`  ${contextDisplay}`);
      console.log(
        `  ${burnRateDisplay} ${burnRateStatus} | ${usedDisplay} | ${projectedDisplay}`,
      );
    } catch (error) {
      console.error(
        "Error updating status:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    await new Promise((resolve) => setTimeout(resolve, REFRESH_INTERVAL_MS));
  }
}

main().catch(console.error);
