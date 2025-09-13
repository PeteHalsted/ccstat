// Simple session blocks for ccstat-standalone
import { LoadedUsageEntry, getTotalTokens } from './data-loader-simple.js';

export const DEFAULT_SESSION_DURATION_HOURS = 5;

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface SessionBlock {
  id: string;
  startTime: Date;
  endTime: Date;
  actualEndTime: Date;
  isActive: boolean;
  isGap?: boolean;
  entries: LoadedUsageEntry[];
  tokenCounts: TokenCounts;
  costUSD: number;
  models: string[];
}

export interface BurnRate {
  tokensPerMinute: number;
  tokensPerMinuteForIndicator: number;
  costPerHour: number;
}

export interface ProjectedUsage {
  totalTokens: number;
  totalCost: number;
  remainingMinutes: number;
}

function floorToHour(timestamp: Date): Date {
  const floored = new Date(timestamp);
  floored.setUTCMinutes(0, 0, 0);
  return floored;
}

export function identifySessionBlocks(entries: LoadedUsageEntry[], sessionDurationHours = DEFAULT_SESSION_DURATION_HOURS): SessionBlock[] {
  if (entries.length === 0) {
    return [];
  }

  const sessionDurationMs = sessionDurationHours * 60 * 60 * 1000;
  const blocks: SessionBlock[] = [];
  const sortedEntries = [...entries].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  let currentBlockStart: Date | null = null;
  let currentBlockEntries: LoadedUsageEntry[] = [];
  const now = new Date();

  for (const entry of sortedEntries) {
    const entryTime = entry.timestamp;

    if (currentBlockStart == null) {
      currentBlockStart = floorToHour(entryTime);
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
        const block = createBlock(currentBlockStart, currentBlockEntries, now, sessionDurationMs);
        blocks.push(block);

        // Start new block
        currentBlockStart = floorToHour(entryTime);
        currentBlockEntries = [entry];
      } else {
        currentBlockEntries.push(entry);
      }
    }
  }

  // Close the last block
  if (currentBlockStart != null && currentBlockEntries.length > 0) {
    const block = createBlock(currentBlockStart, currentBlockEntries, now, sessionDurationMs);
    blocks.push(block);
  }

  return blocks;
}

function createBlock(startTime: Date, entries: LoadedUsageEntry[], now: Date, sessionDurationMs: number): SessionBlock {
  const endTime = new Date(startTime.getTime() + sessionDurationMs);
  const lastEntry = entries[entries.length - 1];
  const actualEndTime = lastEntry != null ? lastEntry.timestamp : startTime;
  const isActive = now.getTime() - actualEndTime.getTime() < sessionDurationMs && now < endTime;

  // Aggregate token counts
  const tokenCounts: TokenCounts = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };

  let costUSD = 0;
  const models: string[] = [];

  for (const entry of entries) {
    tokenCounts.inputTokens += entry.usage.inputTokens;
    tokenCounts.outputTokens += entry.usage.outputTokens;
    tokenCounts.cacheCreationInputTokens += entry.usage.cacheCreationInputTokens;
    tokenCounts.cacheReadInputTokens += entry.usage.cacheReadInputTokens;
    costUSD += entry.costUSD ?? 0;
    models.push(entry.model);
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
    models: [...new Set(models)],
  };
}

export function calculateBurnRate(block: SessionBlock): BurnRate | null {
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

  const totalTokens = getTotalTokens(block.tokenCounts);
  const tokensPerMinute = totalTokens / durationMinutes;

  // For burn rate indicator, use only input and output tokens
  const nonCacheTokens = (block.tokenCounts.inputTokens ?? 0) + (block.tokenCounts.outputTokens ?? 0);
  const tokensPerMinuteForIndicator = nonCacheTokens / durationMinutes;

  const costPerHour = (block.costUSD / durationMinutes) * 60;

  return {
    tokensPerMinute,
    tokensPerMinuteForIndicator,
    costPerHour,
  };
}

export function projectBlockUsage(block: SessionBlock): ProjectedUsage | null {
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

  const totalCost = block.costUSD + (burnRate.costPerHour * (remainingMinutes / 60));

  return {
    totalTokens,
    totalCost,
    remainingMinutes,
  };
}
