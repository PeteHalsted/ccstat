#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { loadUsageEntries } from "./data-loader-simple.js";
import { identifySessionBlocks } from "./session-blocks-simple.js";
import { readOnlyDataAccess } from "./data-access.js";
import { contextDataReader } from "./context-data-reader.js";
import {
  loadConfig,
  getEffectiveTokenLimit,
  updateObservedMaxIfHigher,
  type CcstatConfig,
} from "./config.js";
import { USER_HOME_DIR } from "./constants.js";

const execPromise = promisify(exec);

// ---- Configuration ----
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

// ---- Number Formatting Helper ----
const formatTokensCompact = (tokens: number): string => {
  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(1) + "M";
  } else if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + "k";
  } else {
    return tokens.toString();
  }
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

// Helper functions copied from ccusage
function getTotalTokens(tokenCounts: {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}): number {
  return (
    (tokenCounts.inputTokens ?? 0) +
    (tokenCounts.outputTokens ?? 0) +
    (tokenCounts.cacheCreationInputTokens ?? 0) +
    (tokenCounts.cacheReadInputTokens ?? 0)
  );
}

function calculateBurnRate(block: any) {
  if (block.entries.length === 0 || (block.isGap ?? false)) {
    return null;
  }

  const firstEntry = block.entries[0];
  const lastEntry = block.entries[block.entries.length - 1];

  if (firstEntry == null || lastEntry == null) {
    return null;
  }

  const durationMinutes =
    (lastEntry.timestamp.getTime() - firstEntry.timestamp.getTime()) /
    (1000 * 60);

  if (durationMinutes <= 0) {
    return null;
  }

  const totalTokens = getTotalTokens(block.tokenCounts);
  const tokensPerMinute = totalTokens / durationMinutes;

  // For burn rate indicator, use only input and output tokens
  const nonCacheTokens =
    (block.tokenCounts.inputTokens ?? 0) +
    (block.tokenCounts.outputTokens ?? 0);
  const tokensPerMinuteForIndicator = nonCacheTokens / durationMinutes;

  const costPerHour = (block.costUSD / durationMinutes) * 60;

  return {
    tokensPerMinute,
    tokensPerMinuteForIndicator,
    costPerHour,
  };
}

function projectBlockUsage(block: any) {
  if (!block.isActive || (block.isGap ?? false)) {
    return null;
  }

  const burnRate = calculateBurnRate(block);
  if (burnRate == null) {
    return null;
  }

  const now = new Date();
  const remainingTime = block.endTime.getTime() - now.getTime();
  const remainingMinutes = Math.max(0, remainingTime / (1000 * 60));

  const currentTokens = getTotalTokens(block.tokenCounts);
  const projectedAdditionalTokens = burnRate.tokensPerMinute * remainingMinutes;
  const totalTokens = currentTokens + projectedAdditionalTokens;

  const projectedAdditionalCost =
    (burnRate.costPerHour / 60) * remainingMinutes;
  const totalCost = block.costUSD + projectedAdditionalCost;

  return {
    totalTokens: Math.round(totalTokens),
    totalCost: Math.round(totalCost * 100) / 100,
    remainingMinutes: Math.round(remainingMinutes),
  };
}

// ---- Main Logic ----
async function main() {
  let high_water_mark = 0;
  let isFirstRender = true;
  try {
    const data = await readFile(HIGH_WATER_MARK_FILE, "utf8");
    high_water_mark = parseInt(data, 10) || 0;
  } catch (error) {
    // File doesn't exist yet, which is fine
  }

  // Load ccstat.json configuration
  let config = await loadConfig();

  // Clear screen once at startup to handle process restarts (skip in debug mode)
  if (!config.DEBUG_OUTPUT) {
    process.stdout.write("\x1B[2J\x1B[0;0H");
  }

  if (config.DEBUG_OUTPUT) {
    console.log(
      `DEBUG: Config loaded with DEBUG_OUTPUT=${config.DEBUG_OUTPUT}`,
    );
  }

  while (true) {
    try {
      // Use ccusage's exact data loading logic for blocks, but keep isolated context calculation
      const [entries, contextSessions, gitBranch, pwd] = await Promise.all([
        loadUsageEntries(config.DEBUG_OUTPUT), // Now uses ccusage's exact validation logic for blocks
        contextDataReader.getContextSessionData(), // ISOLATED for context only
        getGitBranch(),
        execPromise("pwd"),
      ]);

      // Use ccusage's exact session blocks logic
      const blocks = identifySessionBlocks(entries);

      if (config.DEBUG_OUTPUT) {
        console.log(`DEBUG: Total entries loaded: ${entries.length}`);
        console.log(`DEBUG: Total blocks created: ${blocks.length}`);
        console.log(
          `DEBUG: Block entry counts: ${blocks.map((b) => b.entries.length).join(", ")}`,
        );
      }

      // Smart project detection: try current dir, then parent dirs
      const currentPath = pwd.stdout.trim();
      const activeContextSession = contextDataReader.findContextSessionByPath(
        contextSessions,
        currentPath,
      );
      const activeBlock = blocks.find((block) => block.isActive);

      // Constants from config
      const EFFECTIVE_TOKEN_LIMIT = getEffectiveTokenLimit(config);

      // --- Extract and Format Data ---
      let timeDisplay = colorize("yellow", "⏰ N/A");
      let contextDisplay = colorize("green", "🧠 N/A");
      let burnRateDisplay = colorize("green", "🔥 🟢 (Normal)");
      let usedDisplay = colorize("green", "Used: 0%");
      let projectedDisplay = colorize("green", "Projected: 0%");

      if (activeBlock) {
        const projection = projectBlockUsage(activeBlock);
        const remainingMinutes = projection?.remainingMinutes ?? 0;
        const h = Math.floor(remainingMinutes / 60);
        const m = Math.round(remainingMinutes % 60);

        // Progress bar shows how much of the 5 hours has been USED
        const usedMinutes = config.MAX_BLOCK_MINUTES - remainingMinutes;
        const timePct = (usedMinutes * 100) / config.MAX_BLOCK_MINUTES;
        const timeBar = progressBar(timePct);
        const timeText = `⏰ ${h}h ${m}m left`;
        timeDisplay = `${timeText} [${timeBar}]`;

        const burnRate = calculateBurnRate(activeBlock);
        const tokensPerMinute = burnRate?.tokensPerMinuteForIndicator || 0;

        if (tokensPerMinute > config.BURN_RATE_HIGH_THRESHOLD)
          burnRateDisplay = colorize("red", "🔥 🚨 (High)");
        else if (tokensPerMinute > config.BURN_RATE_MODERATE_THRESHOLD)
          burnRateDisplay = colorize("yellow", "🔥 ⚠️ (Moderate)");
        else burnRateDisplay = colorize("green", "🔥 🟢 (Normal)");

        const blockTotalTokens = getTotalTokens(activeBlock.tokenCounts);
        const usedPct = Math.round(
          (blockTotalTokens * 100) / EFFECTIVE_TOKEN_LIMIT,
        );
        usedDisplay = `Used: ${usedPct}%`;

        const projectedTokens = projection?.totalTokens || 0;
        const projectedPct = Math.round(
          (projectedTokens * 100) / EFFECTIVE_TOKEN_LIMIT,
        );
        projectedDisplay = `Projected: ${projectedPct}%`;

        // Update observed max if this block is higher
        config = await updateObservedMaxIfHigher(config, blockTotalTokens);

        const timeColor =
          timePct >= config.TIME_CRITICAL_THRESHOLD
            ? "red"
            : timePct >= config.TIME_WARNING_THRESHOLD
              ? "yellow"
              : "green";
        const usedColor =
          usedPct >= config.USAGE_CRITICAL_THRESHOLD
            ? "red"
            : usedPct >= config.USAGE_WARNING_THRESHOLD
              ? "yellow"
              : "green";
        const projectedColor =
          projectedPct >= config.USAGE_CRITICAL_THRESHOLD
            ? "red"
            : projectedPct >= config.USAGE_WARNING_THRESHOLD
              ? "yellow"
              : "green";
        timeDisplay = colorize(timeColor, timeDisplay);
        usedDisplay = colorize(usedColor, usedDisplay);
        projectedDisplay = colorize(projectedColor, projectedDisplay);

        if (blockTotalTokens > high_water_mark) {
          high_water_mark = blockTotalTokens;
          await writeFile(HIGH_WATER_MARK_FILE, high_water_mark.toString());
        }
      }

      if (activeContextSession) {
        // For ACP sessions, use cache_read_tokens as the real context usage
        const currentTokens =
          activeContextSession.cacheReadTokens ||
          activeContextSession.inputTokens ||
          0;
        const contextPct = Math.round(
          (currentTokens * 100) / config.MAX_CONTEXT_TOKENS,
        );
        const contextBar = progressBar(contextPct);
        const contextText = `🧠 ${currentTokens.toLocaleString()} (${contextPct}%)`;
        contextDisplay = `${contextText} [${contextBar}]`;

        const contextColor =
          contextPct >= config.CONTEXT_CRITICAL_THRESHOLD
            ? "red"
            : contextPct >= config.CONTEXT_WARNING_THRESHOLD
              ? "yellow"
              : "green";
        contextDisplay = colorize(contextColor, contextDisplay);
      }

      // --- Render Status Line ---
      if (!config.DEBUG_OUTPUT) {
        if (!isFirstRender) {
          // Move cursor up 4 lines to overwrite previous status
          process.stdout.write("\x1B[4A");
        } else {
          isFirstRender = false;
        }
      }

      const currentDir = pwd.stdout.trim().replace(USER_HOME_DIR, "~");
      console.log(
        `  ${colorize("dir", `📁 ${currentDir}`)}  ${colorize("git", gitBranch ? `🌿 ${gitBranch}` : "")}\x1B[K`,
      );
      console.log(`  ${timeDisplay}\x1B[K`);
      console.log(`  ${contextDisplay}\x1B[K`);
      console.log(
        `  ${burnRateDisplay} | ${usedDisplay} | ${projectedDisplay}\x1B[K`,
      );

      // DEBUG: Show debug info AFTER status display
      if (activeBlock && config.DEBUG_OUTPUT) {
        const projection = projectBlockUsage(activeBlock);
        const blockTokens = getTotalTokens(activeBlock.tokenCounts);
        const burnRate = calculateBurnRate(activeBlock);
        const tokensPerMinute = burnRate?.tokensPerMinuteForIndicator || 0;

        console.log(`\nDEBUG BLOCK TOKENS:`);
        console.log(`  Block Start: ${activeBlock.startTime.toISOString()}`);
        console.log(`  Block End: ${activeBlock.endTime.toISOString()}`);
        console.log(
          `  First Entry: ${activeBlock.entries[0]?.timestamp.toISOString() || "N/A"}`,
        );
        console.log(
          `  Last Entry: ${activeBlock.entries[activeBlock.entries.length - 1]?.timestamp.toISOString() || "N/A"}`,
        );
        console.log(
          `  Input: ${activeBlock.tokenCounts.inputTokens?.toLocaleString() || 0}`,
        );
        console.log(
          `  Output: ${activeBlock.tokenCounts.outputTokens?.toLocaleString() || 0}`,
        );
        console.log(
          `  Cache Creation: ${activeBlock.tokenCounts.cacheCreationInputTokens?.toLocaleString() || 0}`,
        );
        console.log(
          `  Cache Read: ${activeBlock.tokenCounts.cacheReadInputTokens?.toLocaleString() || 0}`,
        );
        console.log(`  TOTAL BLOCK: ${blockTokens.toLocaleString()}`);
        console.log(`  Entries: ${activeBlock.entries.length}`);
        console.log(
          `  Token Limit: ${EFFECTIVE_TOKEN_LIMIT.toLocaleString()} ${config.USE_OBSERVED_IF_HIGHER && config.OBSERVED_MAX_TOKEN > config.TOKEN_LIMIT ? "(OBSERVED)" : "(CONFIGURED)"}`,
        );
        console.log(
          `  Usage %: ${Math.round((blockTokens * 100) / EFFECTIVE_TOKEN_LIMIT)}%`,
        );
        if (projection) {
          console.log(
            `  Projected Total: ${projection.totalTokens.toLocaleString()}`,
          );
          console.log(
            `  Projected %: ${Math.round((projection.totalTokens * 100) / EFFECTIVE_TOKEN_LIMIT)}%`,
          );
        }

        console.log(`\nDEBUG BURN RATE:`);
        console.log(
          `  Tokens/min: ${burnRate?.tokensPerMinute ? formatTokensCompact(Math.round(burnRate.tokensPerMinute)) : "null"}`,
        );
        console.log(
          `  Tokens/min (indicator): ${formatTokensCompact(Math.round(tokensPerMinute))}`,
        );
      }
    } catch (error) {
      console.log(
        "Error updating status:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, config.REFRESH_INTERVAL_MS),
    );
  }
}

main().catch(console.error);
