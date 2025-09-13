// COPIED EXACTLY FROM CCUSAGE data-loader.ts
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import { z } from "zod";

// Copy ccusage schemas exactly
const isoTimestampSchema = z
  .string()
  .refine((val: string) => !isNaN(Date.parse(val)), {
    message: "Invalid ISO timestamp",
  });

const sessionIdSchema = z.string();
const versionSchema = z.string();
const modelNameSchema = z.string();
const messageIdSchema = z.string();
const requestIdSchema = z.string();

/**
 * Zod schema for validating Claude usage data from JSONL files - COPIED EXACTLY FROM CCUSAGE
 */
export const usageDataSchema = z.object({
  cwd: z.string().optional(), // Claude Code version, optional for compatibility
  sessionId: sessionIdSchema.optional(), // Session ID for deduplication
  timestamp: isoTimestampSchema,
  version: versionSchema.optional(), // Claude Code version
  message: z.object({
    usage: z.object({
      input_tokens: z.number(),
      output_tokens: z.number(),
      cache_creation_input_tokens: z.number().optional(),
      cache_read_input_tokens: z.number().optional(),
    }),
    model: modelNameSchema.optional(), // Model is inside message object
    id: messageIdSchema.optional(), // Message ID for deduplication
    content: z
      .array(
        z.object({
          text: z.string().optional(),
        }),
      )
      .optional(),
  }),
  costUSD: z.number().optional(), // Made optional for new schema
  requestId: requestIdSchema.optional(), // Request ID for deduplication
  isApiErrorMessage: z.boolean().optional(),
});

/**
 * Type definition for Claude usage data entries from JSONL files - COPIED EXACTLY FROM CCUSAGE
 */
export type UsageData = z.infer<typeof usageDataSchema>;

export interface LoadedUsageEntry {
  readonly timestamp: Date;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationTokens: number;
  readonly cacheReadTokens: number;
  readonly messageId: string | null;
  readonly requestId: string | null;
  readonly sessionId: string | null;
  readonly model: string | null;
  readonly projectName: string;
  readonly costUSD: number;
}

export interface SessionData {
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalCacheCreationTokens: number;
  readonly totalCacheReadTokens: number;
  readonly totalCostUSD: number;
  readonly entryCount: number;
  readonly uniqueEntryCount: number;
  readonly duplicateCount: number;
  readonly firstTimestamp: Date | null;
  readonly lastTimestamp: Date | null;
  readonly projectNames: readonly string[];
  readonly models: readonly string[];
}

export interface UsageDataResult {
  readonly allEntries: readonly LoadedUsageEntry[];
  readonly sessionData: SessionData;
}

/**
 * Create a unique identifier for deduplication using message ID and request ID - COPIED EXACTLY FROM CCUSAGE
 */
export function createUniqueHash(data: UsageData): string | null {
  const messageId = data.message.id;
  const requestId = data.requestId;

  if (messageId == null || requestId == null) {
    return null;
  }

  // Create a hash using simple concatenation
  return `${messageId}:${requestId}`;
}

/**
 * Checks if an entry is a duplicate based on hash - COPIED EXACTLY FROM CCUSAGE
 */
function isDuplicateEntry(
  uniqueHash: string | null,
  processedHashes: Set<string>,
): boolean {
  if (uniqueHash == null) {
    return false;
  }
  return processedHashes.has(uniqueHash);
}

/**
 * Marks an entry as processed - COPIED EXACTLY FROM CCUSAGE
 */
function markAsProcessed(
  uniqueHash: string | null,
  processedHashes: Set<string>,
): void {
  if (uniqueHash != null) {
    processedHashes.add(uniqueHash);
  }
}

/**
 * Extract project name from Claude JSONL file path - COPIED FROM CCUSAGE
 */
export function extractProjectFromPath(jsonlPath: string): string {
  // Normalize path separators for cross-platform compatibility
  const normalizedPath = jsonlPath.replace(/[/\\]/g, path.sep);
  const segments = normalizedPath.split(path.sep);
  const projectsIndex = segments.findIndex((segment) => segment === "projects");

  if (projectsIndex === -1 || projectsIndex + 1 >= segments.length) {
    return "unknown";
  }

  const projectName = segments[projectsIndex + 1];
  return projectName != null && projectName.trim() !== ""
    ? projectName
    : "unknown";
}

// Load usage entries using EXACT ccusage validation logic
export async function loadUsageEntries(
  debugOutput: boolean = false,
): Promise<LoadedUsageEntry[]> {
  if (debugOutput) {
    console.log(
      `DEBUG: Starting loadUsageEntries with debugOutput=${debugOutput}`,
    );
  }

  const home = homedir();
  const claudeDirs = [
    path.join(home, ".config", "claude", "projects"),
    path.join(home, ".claude", "projects"),
  ].filter((dir) => fs.existsSync(dir));

  if (debugOutput) {
    console.log(`DEBUG: Found Claude directories: ${claudeDirs.join(", ")}`);
  }

  const entries: LoadedUsageEntry[] = [];

  // Track processed message+request combinations for deduplication - COPIED FROM CCUSAGE
  const processedHashes = new Set<string>();

  for (const claudeDir of claudeDirs) {
    const projects = fs.readdirSync(claudeDir);
    for (const project of projects) {
      const projectPath = path.join(claudeDir, project);
      if (fs.statSync(projectPath).isDirectory()) {
        const files = fs
          .readdirSync(projectPath, { recursive: true })
          .filter((f) => typeof f === "string" && f.endsWith(".jsonl"))
          .map((f) => path.join(projectPath, f as string));

        if (debugOutput && files.length > 0) {
          console.log(
            `DEBUG: Found ${files.length} .jsonl files in ${projectPath}`,
          );
        }

        for (const filePath of files) {
          // Check file modification time to skip old files
          // Use 24 hours to be safe across all timezones
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

          try {
            const fileStats = fs.statSync(filePath);
            // File mtime is in local time, compare directly with local cutoff
            if (fileStats.mtime < twentyFourHoursAgo) {
              if (debugOutput) {
                console.log(
                  `DEBUG: Skipping old file: ${path.basename(filePath)} (modified: ${fileStats.mtime.toISOString()})`,
                );
              }
              continue; // Skip files older than 24 hours
            }

            if (debugOutput) {
              console.log(
                `DEBUG: Reading recent file: ${path.basename(filePath)} (modified: ${fileStats.mtime.toISOString()})`,
              );
            }
          } catch (error) {
            // If we can't stat the file, skip it
            continue;
          }

          const content = fs.readFileSync(filePath, "utf8");
          const lines = content
            .trim()
            .split("\n")
            .filter((line) => line.length > 0);

          for (const line of lines) {
            try {
              // COPIED EXACTLY FROM CCUSAGE
              const parsed = JSON.parse(line) as unknown;
              const result = usageDataSchema.safeParse(parsed);
              if (!result.success) {
                continue;
              }
              const data = result.data;

              // Check for duplicate message + request ID combination
              const uniqueHash = createUniqueHash(data);
              if (isDuplicateEntry(uniqueHash, processedHashes)) {
                // Skip duplicate message
                continue;
              }

              // Mark this combination as processed
              markAsProcessed(uniqueHash, processedHashes);

              const projectName = extractProjectFromPath(filePath);

              entries.push({
                timestamp: new Date(data.timestamp),
                inputTokens: data.message.usage.input_tokens ?? 0,
                outputTokens: data.message.usage.output_tokens ?? 0,
                cacheCreationTokens:
                  data.message.usage.cache_creation_input_tokens ?? 0,
                cacheReadTokens:
                  data.message.usage.cache_read_input_tokens ?? 0,
                messageId: data.message.id ?? null,
                requestId: data.requestId ?? null,
                sessionId: data.sessionId ?? null,
                model: data.message.model ?? null,
                projectName,
                costUSD: data.costUSD ?? 0,
              });
            } catch (e) {
              // Skip invalid JSON lines
            }
          }
        }
      }
    }
  }

  return entries;
}

// Aggregate session data for context calculation
export async function aggregateSessionData(): Promise<SessionData> {
  const entries = await loadUsageEntries();

  if (entries.length === 0) {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheCreationTokens: 0,
      totalCacheReadTokens: 0,
      totalCostUSD: 0,
      entryCount: 0,
      uniqueEntryCount: 0,
      duplicateCount: 0,
      firstTimestamp: null,
      lastTimestamp: null,
      projectNames: [],
      models: [],
    };
  }

  // Calculate aggregates
  const totalInputTokens = entries.reduce((sum, e) => sum + e.inputTokens, 0);
  const totalOutputTokens = entries.reduce((sum, e) => sum + e.outputTokens, 0);
  const totalCacheCreationTokens = entries.reduce(
    (sum, e) => sum + e.cacheCreationTokens,
    0,
  );
  const totalCacheReadTokens = entries.reduce(
    (sum, e) => sum + e.cacheReadTokens,
    0,
  );
  const totalCostUSD = entries.reduce((sum, e) => sum + e.costUSD, 0);

  // Get unique values
  const projectNames = [...new Set(entries.map((e) => e.projectName))];
  const models = [
    ...new Set(entries.map((e) => e.model).filter((m) => m !== null)),
  ];

  // Find first and last timestamps
  const timestamps = entries
    .map((e) => e.timestamp)
    .sort((a, b) => a.getTime() - b.getTime());
  const firstTimestamp = timestamps[0] || null;
  const lastTimestamp = timestamps[timestamps.length - 1] || null;

  return {
    totalInputTokens,
    totalOutputTokens,
    totalCacheCreationTokens,
    totalCacheReadTokens,
    totalCostUSD,
    entryCount: entries.length,
    uniqueEntryCount: entries.length, // After deduplication
    duplicateCount: 0, // We don't track this separately
    firstTimestamp,
    lastTimestamp,
    projectNames,
    models: models as string[],
  };
}

export function getTotalTokens(tokenCounts: {
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
}): number {
  return (
    (tokenCounts.inputTokens || 0) +
    (tokenCounts.outputTokens || 0) +
    (tokenCounts.cacheCreationInputTokens || 0) +
    (tokenCounts.cacheReadInputTokens || 0)
  );
}
