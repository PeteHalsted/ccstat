// Simple data loader for ccstat-standalone - keeps our working context logic
import fs from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

export interface UsageData {
  timestamp: string;
  message: {
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    };
  };
  model: string;
}

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
}

export interface SessionData {
  sessionId: string;
  cacheReadTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  entries: LoadedUsageEntry[];
}

// Keep our working data loading functions
export async function loadUsageEntries(): Promise<LoadedUsageEntry[]> {
  const home = homedir();
  const claudeDirs = [
    path.join(home, '.config', 'claude', 'projects'),
    path.join(home, '.claude', 'projects')
  ].filter(dir => fs.existsSync(dir));

  const entries: LoadedUsageEntry[] = [];

  for (const claudeDir of claudeDirs) {
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
              const data = JSON.parse(line) as UsageData;
              if (data.timestamp && data.message?.usage) {
                entries.push({
                  timestamp: new Date(data.timestamp),
                  usage: {
                    inputTokens: data.message.usage.input_tokens || 0,
                    outputTokens: data.message.usage.output_tokens || 0,
                    cacheCreationInputTokens: data.message.usage.cache_creation_input_tokens || 0,
                    cacheReadInputTokens: data.message.usage.cache_read_input_tokens || 0,
                  },
                  costUSD: null,
                  model: data.model || 'unknown'
                });
              }
            } catch (e) {
              // Skip malformed lines
            }
          }
        }
      }
    }
  }

  return entries;
}

// Keep our working session aggregation for context
export async function aggregateSessionData(): Promise<SessionData[]> {
  const home = homedir();
  const claudeDirs = [
    path.join(home, '.config', 'claude', 'projects'),
    path.join(home, '.claude', 'projects')
  ].filter(dir => fs.existsSync(dir));

  const sessions: SessionData[] = [];

  for (const claudeDir of claudeDirs) {
    const projects = fs.readdirSync(claudeDir);
    for (const project of projects) {
      const projectPath = path.join(claudeDir, project);
      if (fs.statSync(projectPath).isDirectory()) {
        const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
        for (const file of files) {
          const sessionId = project; // Use project as session ID
          const filePath = path.join(projectPath, file);
          const content = fs.readFileSync(filePath, 'utf8');
          const lines = content.trim().split('\n');

          let cacheReadTokens = 0;
          let inputTokens = 0;
          let outputTokens = 0;
          let cacheCreationTokens = 0;
          let mostRecentTimestamp = new Date(0);
          const entries: LoadedUsageEntry[] = [];

          for (const line of lines) {
            try {
              const data = JSON.parse(line) as UsageData;
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

                entries.push({
                  timestamp,
                  usage: {
                    inputTokens: usage.input_tokens || 0,
                    outputTokens: usage.output_tokens || 0,
                    cacheCreationInputTokens: usage.cache_creation_input_tokens || 0,
                    cacheReadInputTokens: usage.cache_read_input_tokens || 0,
                  },
                  costUSD: null,
                  model: data.model || 'unknown'
                });
              }
            } catch (e) {
              // Skip malformed lines
            }
          }

          if (entries.length > 0) {
            sessions.push({
              sessionId,
              cacheReadTokens,
              inputTokens,
              outputTokens,
              cacheCreationTokens,
              entries
            });
          }
        }
      }
    }
  }

  return sessions;
}

export function getTotalTokens(tokenCounts: { inputTokens?: number; outputTokens?: number; cacheCreationInputTokens?: number; cacheReadInputTokens?: number }): number {
  return (tokenCounts.inputTokens || 0) +
         (tokenCounts.outputTokens || 0) +
         (tokenCounts.cacheCreationInputTokens || 0) +
         (tokenCounts.cacheReadInputTokens || 0);
}
