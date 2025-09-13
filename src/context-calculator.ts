/**
 * ISOLATED CONTEXT CALCULATION MODULE
 *
 * CRITICAL: This module contains the core logic for context calculation and session management.
 * DO NOT MODIFY without explicit understanding of token counting requirements.
 * This module is isolated to prevent accidental changes from affecting context calculations.
 */

import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

// Frozen interfaces to prevent modification
export interface ReadOnlyUsageData {
  readonly timestamp: string;
  readonly message: {
    readonly usage: {
      readonly input_tokens: number;
      readonly output_tokens: number;
      readonly cache_creation_input_tokens: number;
      readonly cache_read_input_tokens: number;
    };
  };
  readonly model: string;
}

export interface ReadOnlyUsageEntry {
  readonly timestamp: Date;
  readonly usage: {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheCreationInputTokens: number;
    readonly cacheReadInputTokens: number;
  };
  readonly costUSD: number | null;
  readonly model: string;
}

export interface ReadOnlySessionData {
  readonly sessionId: string;
  readonly cacheReadTokens: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationTokens: number;
  readonly entries: readonly ReadOnlyUsageEntry[];
}

export interface ReadOnlyTokenCounts {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationInputTokens: number;
  readonly cacheReadInputTokens: number;
}

export interface ReadOnlySessionBlock {
  readonly id: string;
  readonly startTime: Date;
  readonly endTime: Date;
  readonly actualEndTime: Date;
  readonly isActive: boolean;
  readonly isGap?: boolean;
  readonly entries: readonly ReadOnlyUsageEntry[];
  readonly tokenCounts: ReadOnlyTokenCounts;
  readonly costUSD: number;
  readonly models: readonly string[];
}

export interface ReadOnlyBurnRate {
  readonly tokensPerMinute: number;
  readonly tokensPerMinuteForIndicator: number;
  readonly costPerHour: number;
}

export interface ReadOnlyProjectedUsage {
  readonly totalTokens: number;
  readonly totalCost: number;
  readonly remainingMinutes: number;
}

// Frozen constants to prevent modification
const ISOLATED_CONSTANTS = Object.freeze({
  DEFAULT_SESSION_DURATION_HOURS: 5,
  MAX_CONTEXT_TOKENS: 200000,
  MAX_BLOCK_MINUTES: 300,
  PROJECTED_TOKEN_LIMIT: 101685800,
} as const);

/**
 * ISOLATED DATA LOADER - Core context calculation logic
 * DO NOT MODIFY - This maintains the exact logic for token counting
 */
class IsolatedContextCalculator {
  private readonly homeDir: string;
  private readonly claudeDirs: readonly string[];

  constructor() {
    this.homeDir = homedir();
    this.claudeDirs = Object.freeze([
      path.join(this.homeDir, '.config', 'claude', 'projects'),
      path.join(this.homeDir, '.claude', 'projects')
    ].filter(dir => fs.existsSync(dir)));
  }

  /**
   * Load usage entries with exact original logic
   * PROTECTED: Returns immutable data
   */
  async loadUsageEntries(): Promise<readonly ReadOnlyUsageEntry[]> {
    const entries: ReadOnlyUsageEntry[] = [];

    for (const claudeDir of this.claudeDirs) {
      const projects = fs.readdirSync(claudeDir);
      for (const project of projects) {
        const projectPath = path.join(claudeDir, project);
        if (fs.statSync(projectPath).isDirectory()) {
          const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
          for (const file of files) {
            const filePath = path.join(projectPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.trim().split('\n');

            for (const line of lines) {
              try {
                const data = JSON.parse(line) as ReadOnlyUsageData;
                if (data.timestamp && data.message?.usage) {
                  entries.push(Object.freeze({
                    timestamp: new Date(data.timestamp),
                    usage: Object.freeze({
                      inputTokens: data.message.usage.input_tokens || 0,
                      outputTokens: data.message.usage.output_tokens || 0,
                      cacheCreationInputTokens: data.message.usage.cache_creation_input_tokens || 0,
                      cacheReadInputTokens: data.message.usage.cache_read_input_tokens || 0,
                    }),
                    costUSD: null,
                    model: data.model || 'unknown'
                  }));
                }
              } catch (e) {
                // Skip malformed lines - exactly as original
              }
            }
          }
        }
      }
    }

    return Object.freeze(entries);
  }

  /**
   * Aggregate session data with exact original logic
   * PROTECTED: Returns immutable data
   */
  async aggregateSessionData(): Promise<readonly ReadOnlySessionData[]> {
    const sessions: ReadOnlySessionData[] = [];

    for (const claudeDir of this.claudeDirs) {
      const projects = fs.readdirSync(claudeDir);
      for (const project of projects) {
        const projectPath = path.join(claudeDir, project);
        if (fs.statSync(projectPath).isDirectory()) {
          const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
          for (const file of files) {
            const sessionId = project; // Use project as session ID - exactly as original
            const filePath = path.join(projectPath, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.trim().split('\n');

            let cacheReadTokens = 0;
            let inputTokens = 0;
            let outputTokens = 0;
            let cacheCreationTokens = 0;
            let mostRecentTimestamp = new Date(0);
            const entries: ReadOnlyUsageEntry[] = [];

            for (const line of lines) {
              try {
                const data = JSON.parse(line) as ReadOnlyUsageData;
                if (data.timestamp && data.message?.usage) {
                  const timestamp = new Date(data.timestamp);
                  const usage = data.message.usage;

                  // For context calculation - use most recent cache_read_tokens
                  if (usage.cache_read_input_tokens > 0 && timestamp >= mostRecentTimestamp) {
                    cacheReadTokens = usage.cache_read_input_tokens;
                    mostRecentTimestamp = timestamp;
                  }

                  // Sum other tokens
                  inputTokens += usage.input_tokens || 0;
                  outputTokens += usage.output_tokens || 0;
                  cacheCreationTokens += usage.cache_creation_input_tokens || 0;

                  entries.push(Object.freeze({
                    timestamp,
                    usage: Object.freeze({
                      inputTokens: usage.input_tokens || 0,
                      outputTokens: usage.output_tokens || 0,
                      cacheCreationInputTokens: usage.cache_creation_input_tokens || 0,
                      cacheReadInputTokens: usage.cache_read_input_tokens || 0,
                    }),
                    costUSD: null,
                    model: data.model || 'unknown'
                  }));
                }
              } catch (e) {
                // Skip malformed lines - exactly as original
              }
            }

            if (entries.length > 0) {
              sessions.push(Object.freeze({
                sessionId,
                cacheReadTokens,
                inputTokens,
                outputTokens,
                cacheCreationTokens,
                entries: Object.freeze(entries)
              }));
            }
          }
        }
      }
    }

    return Object.freeze(sessions);
  }

  /**
   * Get total tokens with exact original logic
   * PROTECTED: Pure function with no side effects
   */
  getTotalTokens(tokenCounts: ReadOnlyTokenCounts): number {
    return (tokenCounts.inputTokens || 0) +
           (tokenCounts.outputTokens || 0) +
           (tokenCounts.cacheCreationInputTokens || 0) +
           (tokenCounts.cacheReadInputTokens || 0);
  }

  /**
   * Identify session blocks with exact original logic
   * PROTECTED: Returns immutable data
   */
  identifySessionBlocks(
    entries: readonly ReadOnlyUsageEntry[],
    sessionDurationHours = ISOLATED_CONSTANTS.DEFAULT_SESSION_DURATION_HOURS
  ): readonly ReadOnlySessionBlock[] {
    if (entries.length === 0) {
      return Object.freeze([]);
    }

    const sessionDurationMs = sessionDurationHours * 60 * 60 * 1000;
    const blocks: ReadOnlySessionBlock[] = [];
    const sortedEntries = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let currentBlockStart: Date | null = null;
    let currentBlockEntries: ReadOnlyUsageEntry[] = [];
    const now = new Date();

    for (const entry of sortedEntries) {
      const entryTime = entry.timestamp;

      if (currentBlockStart == null) {
        currentBlockStart = this.floorToHour(entryTime);
        currentBlockEntries = [entry];
      } else {
        const timeSinceBlockStart = entryTime.getTime() - currentBlockStart.getTime();
        const lastEntry = currentBlockEntries.at(-1);

        if (lastEntry == null) {
          continue;
        }

        const lastEntryTime = lastEntry.timestamp;
        const timeSinceLastEntry = entryTime.getTime() - lastEntryTime.getTime();

        if (timeSinceBlockStart > sessionDurationMs || timeSinceLastEntry > sessionDurationMs) {
          // Close current block
          const block = this.createBlock(currentBlockStart, currentBlockEntries, now, sessionDurationMs);
          blocks.push(block);

          // Start new block
          currentBlockStart = this.floorToHour(entryTime);
          currentBlockEntries = [entry];
        } else {
          currentBlockEntries.push(entry);
        }
      }
    }

    // Close the last block
    if (currentBlockStart != null && currentBlockEntries.length > 0) {
      const block = this.createBlock(currentBlockStart, currentBlockEntries, now, sessionDurationMs);
      blocks.push(block);
    }

    return Object.freeze(blocks);
  }

  /**
   * Calculate burn rate with exact original logic
   * PROTECTED: Pure function with no side effects
   */
  calculateBurnRate(block: ReadOnlySessionBlock): ReadOnlyBurnRate | null {
    if (block.entries.length === 0 || (block.isGap ?? false)) {
      return null;
    }

    const firstEntry = block.entries[0];
    const lastEntry = block.entries[block.entries.length - 1];

    if (firstEntry == null || lastEntry == null) {
      return null;
    }

    const durationMinutes = (lastEntry.timestamp.getTime() - firstEntry.timestamp.getTime()) / (1000 * 60);

    if (durationMinutes <= 0) {
      return null;
    }

    const totalTokens = this.getTotalTokens(block.tokenCounts);
    const tokensPerMinute = totalTokens / durationMinutes;

    // For burn rate indicator, use only input and output tokens
    const nonCacheTokens = (block.tokenCounts.inputTokens ?? 0) + (block.tokenCounts.outputTokens ?? 0);
    const tokensPerMinuteForIndicator = nonCacheTokens / durationMinutes;

    const costPerHour = (block.costUSD / durationMinutes) * 60;

    return Object.freeze({
      tokensPerMinute,
      tokensPerMinuteForIndicator,
      costPerHour,
    });
  }

  /**
   * Project block usage with exact original logic
   * PROTECTED: Pure function with no side effects
   */
  projectBlockUsage(block: ReadOnlySessionBlock): ReadOnlyProjectedUsage | null {
    if (!block.isActive || (block.isGap ?? false)) {
      return null;
    }

    const burnRate = this.calculateBurnRate(block);
    if (burnRate == null) {
      return null;
    }

    const now = new Date();
    const remainingTime = block.endTime.getTime() - now.getTime();
    const remainingMinutes = Math.max(0, remainingTime / (1000 * 60));

    const currentTokens = this.getTotalTokens(block.tokenCounts);
    const projectedAdditionalTokens = burnRate.tokensPerMinute * remainingMinutes;
    const totalTokens = currentTokens + projectedAdditionalTokens;

    const totalCost = block.costUSD + (burnRate.costPerHour * (remainingMinutes / 60));

    return Object.freeze({
      totalTokens,
      totalCost,
      remainingMinutes,
    });
  }

  /**
   * Floor to hour helper - exact original logic
   * PROTECTED: Pure function with no side effects
   */
  private floorToHour(timestamp: Date): Date {
    const floored = new Date(timestamp);
    floored.setUTCMinutes(0, 0, 0);
    return floored;
  }

  /**
   * Create block helper - exact original logic
   * PROTECTED: Returns immutable data
   */
  private createBlock(
    startTime: Date,
    entries: readonly ReadOnlyUsageEntry[],
    now: Date,
    sessionDurationMs: number
  ): ReadOnlySessionBlock {
    const endTime = new Date(startTime.getTime() + sessionDurationMs);
    const lastEntry = entries[entries.length - 1];
    const actualEndTime = lastEntry != null ? lastEntry.timestamp : startTime;
    const isActive = now.getTime() - actualEndTime.getTime() < sessionDurationMs && now < endTime;

    // Aggregate token counts
    const tokenCounts: ReadOnlyTokenCounts = {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };

    let costUSD = 0;
    const models: string[] = [];

    for (const entry of entries) {
      (tokenCounts as any).inputTokens += entry.usage.inputTokens;
      (tokenCounts as any).outputTokens += entry.usage.outputTokens;
      (tokenCounts as any).cacheCreationInputTokens += entry.usage.cacheCreationInputTokens;
      (tokenCounts as any).cacheReadInputTokens += entry.usage.cacheReadInputTokens;
      costUSD += entry.costUSD ?? 0;
      models.push(entry.model);
    }

    return Object.freeze({
      id: startTime.toISOString(),
      startTime,
      endTime,
      actualEndTime,
      isActive,
      entries: Object.freeze([...entries]),
      tokenCounts: Object.freeze(tokenCounts),
      costUSD,
      models: Object.freeze([...new Set(models)]),
    });
  }

  /**
   * Get constants - read-only access to isolated constants
   */
  getConstants() {
    return ISOLATED_CONSTANTS;
  }
}

// Export singleton instance to prevent multiple instantiation
export const isolatedContextCalculator = Object.freeze(new IsolatedContextCalculator());

// Export constants for read-only access
export const ISOLATED_CONTEXT_CONSTANTS = ISOLATED_CONSTANTS;
