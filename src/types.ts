/**
 * Represents a single usage data entry loaded from JSONL files
 */
export interface LoadedUsageEntry {
  timestamp: Date;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens: number;
    cacheReadInputTokens: number;
  };
  costUSD: number | null;
  model: string;
  version?: string;
  sessionId?: string;
  usageLimitResetTime?: Date;
}

/**
 * Aggregated token counts for different token types
 */
export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

/**
 * Represents a session block (typically 5-hour billing period) with usage data
 */
export interface SessionBlock {
  id: string; // ISO string of block start time
  startTime: Date;
  endTime: Date; // startTime + 5 hours (for normal blocks)
  actualEndTime?: Date; // Last activity in block
  isActive: boolean;
  isGap?: boolean; // True if this is a gap block
  entries: LoadedUsageEntry[];
  tokenCounts: TokenCounts;
  costUSD: number;
  models: string[];
  usageLimitResetTime?: Date;
}

/**
 * Represents usage burn rate calculations
 */
export interface BurnRate {
  tokensPerMinute: number;
  tokensPerMinuteForIndicator: number;
  costPerHour: number;
}

/**
 * Represents projected usage for remaining time in a session block
 */
export interface ProjectedUsage {
  totalTokens: number;
  totalCost: number;
  remainingMinutes: number;
}

/**
 * Session data aggregated by project/session
 */
export interface SessionData {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalCost: number;
  lastActivity: string;
  modelsUsed: string[];
  projectPath?: string;
}

/**
 * Usage data structure from JSONL files
 */
export interface UsageData {
  sessionId?: string;
  timestamp: string;
  version?: string;
  message: {
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
    model?: string;
    id?: string;
  };
  costUSD?: number;
  requestId?: string;
  isApiErrorMessage?: boolean;
  usageLimitResetTime?: string;
}
