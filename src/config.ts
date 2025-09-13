import { readFile, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { USER_HOME_DIR } from "./constants.js";
import { xdgConfig } from "xdg-basedir";

// XDG config directory
const XDG_CONFIG_DIR = xdgConfig ?? `${USER_HOME_DIR}/.config`;

// Configuration file paths (new XDG location and legacy location)
const CONFIG_FILE_PATH = path.join(XDG_CONFIG_DIR, "ccstat.json");
const LEGACY_CONFIG_FILE_PATH = path.join(USER_HOME_DIR, "ccstat.json");

// Configuration structure
export interface CcstatConfig {
  TOKEN_LIMIT: number;
  OBSERVED_MAX_TOKEN: number;
  USE_OBSERVED_IF_HIGHER: boolean;
  BURN_RATE_HIGH_THRESHOLD: number;
  BURN_RATE_MODERATE_THRESHOLD: number;
  REFRESH_INTERVAL_MS: number;
  MAX_BLOCK_MINUTES: number;
  DEFAULT_SESSION_DURATION_HOURS: number;
  MAX_CONTEXT_TOKENS: number;
  PROJECTED_TOKEN_LIMIT: number;
  BLOCKS_WARNING_THRESHOLD: number;
  TIME_WARNING_THRESHOLD: number;
  TIME_CRITICAL_THRESHOLD: number;
  USAGE_WARNING_THRESHOLD: number;
  USAGE_CRITICAL_THRESHOLD: number;
  CONTEXT_WARNING_THRESHOLD: number;
  CONTEXT_CRITICAL_THRESHOLD: number;
  DEBUG_OUTPUT: boolean;
}

// Default configuration
const DEFAULT_CONFIG: CcstatConfig = {
  TOKEN_LIMIT: 60000000, // 60M tokens
  OBSERVED_MAX_TOKEN: 0,
  USE_OBSERVED_IF_HIGHER: true,
  BURN_RATE_HIGH_THRESHOLD: 1000, // tokens/min for high burn rate warning
  BURN_RATE_MODERATE_THRESHOLD: 500, // tokens/min for moderate burn rate warning
  REFRESH_INTERVAL_MS: 1000, // status refresh interval
  MAX_BLOCK_MINUTES: 300, // 5 hours in minutes
  DEFAULT_SESSION_DURATION_HOURS: 5, // Claude's billing block duration
  MAX_CONTEXT_TOKENS: 200000, // Maximum context tokens for Claude
  PROJECTED_TOKEN_LIMIT: 101685800, // Projected token limit for quota warnings
  BLOCKS_WARNING_THRESHOLD: 0.8, // 80% threshold for showing usage warnings
  TIME_WARNING_THRESHOLD: 80, // 80% time usage warning threshold
  TIME_CRITICAL_THRESHOLD: 90, // 90% time usage critical threshold
  USAGE_WARNING_THRESHOLD: 80, // 80% token usage warning threshold
  USAGE_CRITICAL_THRESHOLD: 90, // 90% token usage critical threshold
  CONTEXT_WARNING_THRESHOLD: 60, // 60% context usage warning threshold
  CONTEXT_CRITICAL_THRESHOLD: 80, // 80% context usage critical threshold
  DEBUG_OUTPUT: false, // Show debug information
};

/**
 * Load ccstat.json configuration file
 * Checks XDG location first, then legacy location for backwards compatibility
 * Migrates legacy config to XDG location if found
 */
export async function loadConfig(): Promise<CcstatConfig> {
  try {
    let configPath = CONFIG_FILE_PATH;
    let shouldMigrate = false;

    // Check XDG location first
    if (!existsSync(CONFIG_FILE_PATH)) {
      // Check legacy location
      if (existsSync(LEGACY_CONFIG_FILE_PATH)) {
        configPath = LEGACY_CONFIG_FILE_PATH;
        shouldMigrate = true;
      } else {
        // No config exists, create default in XDG location
        await saveConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
      }
    }

    const content = await readFile(configPath, "utf8");
    const config = JSON.parse(content) as any;

    // Validate required fields and provide defaults
    const validatedConfig = {
      TOKEN_LIMIT: config.TOKEN_LIMIT ?? DEFAULT_CONFIG.TOKEN_LIMIT,
      OBSERVED_MAX_TOKEN:
        config.OBSERVED_MAX_TOKEN ?? DEFAULT_CONFIG.OBSERVED_MAX_TOKEN,
      USE_OBSERVED_IF_HIGHER:
        config.USE_OBSERVED_IF_HIGHER ??
        config.USEOBSERVED ??
        DEFAULT_CONFIG.USE_OBSERVED_IF_HIGHER,
      BURN_RATE_HIGH_THRESHOLD:
        config.BURN_RATE_HIGH_THRESHOLD ??
        DEFAULT_CONFIG.BURN_RATE_HIGH_THRESHOLD,
      BURN_RATE_MODERATE_THRESHOLD:
        config.BURN_RATE_MODERATE_THRESHOLD ??
        DEFAULT_CONFIG.BURN_RATE_MODERATE_THRESHOLD,
      REFRESH_INTERVAL_MS:
        config.REFRESH_INTERVAL_MS ?? DEFAULT_CONFIG.REFRESH_INTERVAL_MS,
      MAX_BLOCK_MINUTES:
        config.MAX_BLOCK_MINUTES ?? DEFAULT_CONFIG.MAX_BLOCK_MINUTES,
      DEFAULT_SESSION_DURATION_HOURS:
        config.DEFAULT_SESSION_DURATION_HOURS ??
        DEFAULT_CONFIG.DEFAULT_SESSION_DURATION_HOURS,
      MAX_CONTEXT_TOKENS:
        config.MAX_CONTEXT_TOKENS ?? DEFAULT_CONFIG.MAX_CONTEXT_TOKENS,
      PROJECTED_TOKEN_LIMIT:
        config.PROJECTED_TOKEN_LIMIT ?? DEFAULT_CONFIG.PROJECTED_TOKEN_LIMIT,
      BLOCKS_WARNING_THRESHOLD:
        config.BLOCKS_WARNING_THRESHOLD ??
        DEFAULT_CONFIG.BLOCKS_WARNING_THRESHOLD,
      TIME_WARNING_THRESHOLD:
        config.TIME_WARNING_THRESHOLD ?? DEFAULT_CONFIG.TIME_WARNING_THRESHOLD,
      TIME_CRITICAL_THRESHOLD:
        config.TIME_CRITICAL_THRESHOLD ??
        DEFAULT_CONFIG.TIME_CRITICAL_THRESHOLD,
      USAGE_WARNING_THRESHOLD:
        config.USAGE_WARNING_THRESHOLD ??
        DEFAULT_CONFIG.USAGE_WARNING_THRESHOLD,
      USAGE_CRITICAL_THRESHOLD:
        config.USAGE_CRITICAL_THRESHOLD ??
        DEFAULT_CONFIG.USAGE_CRITICAL_THRESHOLD,
      CONTEXT_WARNING_THRESHOLD:
        config.CONTEXT_WARNING_THRESHOLD ??
        DEFAULT_CONFIG.CONTEXT_WARNING_THRESHOLD,
      CONTEXT_CRITICAL_THRESHOLD:
        config.CONTEXT_CRITICAL_THRESHOLD ??
        DEFAULT_CONFIG.CONTEXT_CRITICAL_THRESHOLD,
      DEBUG_OUTPUT: config.DEBUG_OUTPUT ?? DEFAULT_CONFIG.DEBUG_OUTPUT,
    };

    // If we loaded from legacy location, migrate to XDG location
    if (shouldMigrate) {
      await saveConfig(validatedConfig);
      if (validatedConfig.DEBUG_OUTPUT) {
        console.log(
          "📦 Migrated config from ~/ccstat.json to ~/.config/ccstat.json",
        );
      }
    }

    return validatedConfig;
  } catch (error) {
    console.warn(
      `Failed to load ccstat.json, using defaults: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return DEFAULT_CONFIG;
  }
}

/**
 * Save ccstat.json configuration file
 */
export async function saveConfig(config: CcstatConfig): Promise<void> {
  try {
    // Ensure XDG config directory exists
    if (!existsSync(XDG_CONFIG_DIR)) {
      mkdirSync(XDG_CONFIG_DIR, { recursive: true });
    }

    const content = JSON.stringify(config, null, 2);
    await writeFile(CONFIG_FILE_PATH, content, "utf8");
  } catch (error) {
    console.warn(
      `Failed to save ccstat.json: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Get the effective token limit based on configuration
 * Returns OBSERVED_MAX_TOKEN if USE_OBSERVED_IF_HIGHER=true and OBSERVED_MAX_TOKEN > TOKEN_LIMIT, otherwise TOKEN_LIMIT
 */
export function getEffectiveTokenLimit(config: CcstatConfig): number {
  if (
    config.USE_OBSERVED_IF_HIGHER &&
    config.OBSERVED_MAX_TOKEN > config.TOKEN_LIMIT
  ) {
    return config.OBSERVED_MAX_TOKEN;
  }
  return config.TOKEN_LIMIT;
}

/**
 * Update OBSERVED_MAX_TOKEN if blockTotal is higher
 * Automatically saves config if updated
 */
export async function updateObservedMaxIfHigher(
  config: CcstatConfig,
  blockTotal: number,
): Promise<CcstatConfig> {
  if (blockTotal > config.OBSERVED_MAX_TOKEN) {
    const updatedConfig = {
      ...config,
      OBSERVED_MAX_TOKEN: blockTotal,
    };
    await saveConfig(updatedConfig);
    if (config.DEBUG_OUTPUT) {
      console.log(
        `📈 Updated OBSERVED_MAX_TOKEN: ${config.OBSERVED_MAX_TOKEN.toLocaleString()} → ${blockTotal.toLocaleString()}`,
      );
    }
    return updatedConfig;
  }
  return config;
}
