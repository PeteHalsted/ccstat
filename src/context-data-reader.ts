/**
 * STANDALONE CONTEXT DATA READER
 *
 * This module ONLY handles reading Claude JSON files and parsing data specifically for context calculation.
 * It is completely isolated from burn/usage calculations and their filtering logic.
 * DO NOT modify this unless the Claude file format changes.
 */

import fs from "node:fs";
import path from "node:path";
import { USER_HOME_DIR } from "./constants.js";

interface ContextUsageData {
  timestamp: string;
  message: {
    usage: {
      cache_read_input_tokens: number;
      input_tokens: number;
    };
  };
  model: string;
}

interface ContextSessionData {
  sessionId: string;
  cacheReadTokens: number;
  inputTokens: number;
  mostRecentTimestamp: Date;
}

/**
 * ISOLATED CONTEXT DATA READER
 * Reads Claude files ONLY for context calculation - completely separate from burn/usage logic
 */
class ContextDataReader {
  private readonly homeDir: string;
  private readonly claudeDirs: readonly string[];

  constructor() {
    this.homeDir = USER_HOME_DIR;
    this.claudeDirs = Object.freeze(
      [
        path.join(this.homeDir, ".config", "claude", "projects"),
        path.join(this.homeDir, ".claude", "projects"),
      ].filter((dir) => fs.existsSync(dir)),
    );
  }

  /**
   * Read Claude files and extract ONLY context-relevant data
   * This logic is frozen for context calculation and won't change
   */
  async getContextSessionData(): Promise<readonly ContextSessionData[]> {
    const sessions: ContextSessionData[] = [];

    for (const claudeDir of this.claudeDirs) {
      const projects = fs.readdirSync(claudeDir);
      for (const project of projects) {
        const projectPath = path.join(claudeDir, project);
        if (fs.statSync(projectPath).isDirectory()) {
          const files = fs
            .readdirSync(projectPath)
            .filter((f) => f.endsWith(".jsonl"));
          for (const file of files) {
            const sessionId = project; // Use project as session ID
            const filePath = path.join(projectPath, file);
            const content = fs.readFileSync(filePath, "utf8");
            const lines = content.trim().split("\n");

            let cacheReadTokens = 0;
            let inputTokens = 0;
            let mostRecentTimestamp = new Date(0);

            for (const line of lines) {
              try {
                const data = JSON.parse(line) as ContextUsageData;
                if (data.timestamp && data.message?.usage) {
                  const timestamp = new Date(data.timestamp);
                  const usage = data.message.usage;

                  // For context calculation - use most recent cache_read_tokens
                  // This is the EXACT logic that must remain unchanged
                  if (
                    usage.cache_read_input_tokens > 0 &&
                    timestamp >= mostRecentTimestamp
                  ) {
                    cacheReadTokens = usage.cache_read_input_tokens;
                    mostRecentTimestamp = timestamp;
                  }

                  // Sum input tokens for fallback
                  inputTokens += usage.input_tokens || 0;
                }
              } catch (e) {
                // Skip malformed lines
              }
            }

            if (cacheReadTokens > 0 || inputTokens > 0) {
              sessions.push(
                Object.freeze({
                  sessionId,
                  cacheReadTokens,
                  inputTokens,
                  mostRecentTimestamp,
                }),
              );
            }
          }
        }
      }
    }

    return Object.freeze(sessions);
  }

  /**
   * Find context session by path - isolated logic for context only
   */
  findContextSessionByPath(
    sessions: readonly ContextSessionData[],
    currentPath: string,
  ): ContextSessionData | null {
    const pathParts = currentPath.split("/");

    // Try current directory and walk up the tree
    for (let i = pathParts.length; i > 0; i--) {
      const testPath = pathParts.slice(0, i).join("/");
      const testProjName = testPath.split("/").pop() || "";
      const normalizedProjName = testProjName.replace(/\./g, "-");

      const foundSession = sessions.find(
        (s) => s.sessionId && s.sessionId.includes(normalizedProjName),
      );

      if (foundSession) {
        return foundSession;
      }
    }

    return null;
  }

  /**
   * Get context constants - frozen for context calculation
   */
  getContextConstants() {
    return Object.freeze({
      MAX_CONTEXT_TOKENS: 200000,
    });
  }
}

// Export singleton instance to prevent multiple instantiation
export const contextDataReader = Object.freeze(new ContextDataReader());

export type { ContextSessionData };
