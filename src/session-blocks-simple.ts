// COPIED EXACTLY FROM CCUSAGE _session-blocks.ts
import { uniq } from "es-toolkit";
import type { LoadedUsageEntry } from "./data-loader-simple";

/**
 * Default session duration in hours (Claude's billing block duration) - COPIED FROM CCUSAGE
 */
export const DEFAULT_SESSION_DURATION_HOURS = 5;

/**
 * Floors a timestamp to the beginning of the hour in UTC - COPIED FROM CCUSAGE
 * @param timestamp - The timestamp to floor
 * @returns New Date object floored to the UTC hour
 */
function floorToHour(timestamp: Date): Date {
  const floored = new Date(timestamp);
  floored.setUTCMinutes(0, 0, 0);
  return floored;
}

/**
 * Aggregated token counts for different token types - COPIED FROM CCUSAGE
 */
type TokenCounts = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
};

/**
 * Represents a session block (typically 5-hour billing period) with usage data - COPIED FROM CCUSAGE
 */
export type SessionBlock = {
  id: string; // ISO string of block start time
  startTime: Date;
  endTime: Date; // startTime + 5 hours (for normal blocks) or gap end time (for gap blocks)
  actualEndTime?: Date; // Last activity in block
  isActive: boolean;
  isGap?: boolean; // True if this is a gap block
  entries: LoadedUsageEntry[];
  tokenCounts: TokenCounts;
  costUSD: number;
  models: string[];
  usageLimitResetTime?: Date; // Claude API usage limit reset time
};

/**
 * Get total tokens from token counts - COPIED FROM CCUSAGE
 */
function getTotalTokens(tokenCounts: TokenCounts): number {
  return (
    (tokenCounts.inputTokens ?? 0) +
    (tokenCounts.outputTokens ?? 0) +
    (tokenCounts.cacheCreationInputTokens ?? 0) +
    (tokenCounts.cacheReadInputTokens ?? 0)
  );
}

/**
 * Identifies and creates session blocks from usage entries - COPIED EXACTLY FROM CCUSAGE
 * Groups entries into time-based blocks (typically 5-hour periods) with gap detection
 * @param entries - Array of usage entries to process
 * @param sessionDurationHours - Duration of each session block in hours
 * @returns Array of session blocks with aggregated usage data
 */
export function identifySessionBlocks(
  entries: LoadedUsageEntry[],
  sessionDurationHours = DEFAULT_SESSION_DURATION_HOURS,
): SessionBlock[] {
  if (entries.length === 0) {
    return [];
  }

  const sessionDurationMs = sessionDurationHours * 60 * 60 * 1000;
  const blocks: SessionBlock[] = [];
  const sortedEntries = [...entries].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );
  const now = new Date();

  let currentBlockStart: Date | null = null;
  let currentBlockEntries: LoadedUsageEntry[] = [];

  for (const entry of sortedEntries) {
    const entryTime = entry.timestamp;

    if (currentBlockStart == null) {
      // First entry - start a new block (floored to the hour)
      currentBlockStart = floorToHour(entryTime);
      currentBlockEntries = [entry];
    } else {
      const timeSinceBlockStart =
        entryTime.getTime() - currentBlockStart.getTime();
      const lastEntry = currentBlockEntries.at(-1);
      if (lastEntry == null) {
        continue;
      }
      const lastEntryTime = lastEntry.timestamp;
      const timeSinceLastEntry = entryTime.getTime() - lastEntryTime.getTime();

      if (
        timeSinceBlockStart > sessionDurationMs ||
        timeSinceLastEntry > sessionDurationMs
      ) {
        // Close current block
        const block = createBlock(
          currentBlockStart,
          currentBlockEntries,
          now,
          sessionDurationMs,
        );
        blocks.push(block);

        // Add gap block if there's a significant gap
        if (timeSinceLastEntry > sessionDurationMs) {
          const gapBlock = createGapBlock(
            lastEntryTime,
            entryTime,
            sessionDurationMs,
          );
          if (gapBlock != null) {
            blocks.push(gapBlock);
          }
        }

        // Start new block (floored to the hour)
        currentBlockStart = floorToHour(entryTime);
        currentBlockEntries = [entry];
      } else {
        // Add to current block
        currentBlockEntries.push(entry);
      }
    }
  }

  // Close the last block
  if (currentBlockStart != null && currentBlockEntries.length > 0) {
    const block = createBlock(
      currentBlockStart,
      currentBlockEntries,
      now,
      sessionDurationMs,
    );
    blocks.push(block);
  }

  return blocks;
}

/**
 * Creates a session block from a start time and usage entries - COPIED EXACTLY FROM CCUSAGE
 * @param startTime - When the block started
 * @param entries - Usage entries in this block
 * @param now - Current time for active block detection
 * @param sessionDurationMs - Session duration in milliseconds
 * @returns Session block with aggregated data
 */
function createBlock(
  startTime: Date,
  entries: LoadedUsageEntry[],
  now: Date,
  sessionDurationMs: number,
): SessionBlock {
  const endTime = new Date(startTime.getTime() + sessionDurationMs);
  const lastEntry = entries[entries.length - 1];
  const actualEndTime = lastEntry != null ? lastEntry.timestamp : startTime;
  const isActive =
    now.getTime() - actualEndTime.getTime() < sessionDurationMs &&
    now < endTime;

  // Aggregate token counts
  const tokenCounts: TokenCounts = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };

  let costUSD = 0;
  const models: string[] = [];
  let usageLimitResetTime: Date | undefined;

  for (const entry of entries) {
    tokenCounts.inputTokens += entry.inputTokens;
    tokenCounts.outputTokens += entry.outputTokens;
    tokenCounts.cacheCreationInputTokens += entry.cacheCreationTokens;
    tokenCounts.cacheReadInputTokens += entry.cacheReadTokens;
    costUSD += entry.costUSD ?? 0;
    if (entry.model) {
      models.push(entry.model);
    }
  }

  return {
    id: startTime.toISOString(),
    startTime,
    endTime,
    actualEndTime,
    isActive,
    entries,
    tokenCounts,
    costUSD,
    models: uniq(models),
    usageLimitResetTime,
  };
}

/**
 * Creates a gap block representing periods with no activity - COPIED EXACTLY FROM CCUSAGE
 * @param lastActivityTime - Time of last activity before gap
 * @param nextActivityTime - Time of next activity after gap
 * @param sessionDurationMs - Session duration in milliseconds
 * @returns Gap block or null if gap is too short
 */
function createGapBlock(
  lastActivityTime: Date,
  nextActivityTime: Date,
  sessionDurationMs: number,
): SessionBlock | null {
  // Only create gap blocks for gaps longer than the session duration
  const gapDuration = nextActivityTime.getTime() - lastActivityTime.getTime();
  if (gapDuration <= sessionDurationMs) {
    return null;
  }

  const gapStart = new Date(lastActivityTime.getTime() + sessionDurationMs);
  const gapEnd = nextActivityTime;

  return {
    id: `gap-${gapStart.toISOString()}`,
    startTime: gapStart,
    endTime: gapEnd,
    isActive: false,
    isGap: true,
    entries: [],
    tokenCounts: {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    },
    costUSD: 0,
    models: [],
  };
}
