import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { USER_HOME_DIR } from "./constants.js";

// ccstat.json configuration file path
const CONFIG_FILE_PATH = path.join(USER_HOME_DIR, "ccstat.json");

// Configuration structure
export interface CcstatConfig {
  TOKEN_LIMIT: number;
  OBSERVED_MAX_TOKEN: number;
  USE_OBSERVED_IF_HIGHER: boolean;
}

// Default configuration
const DEFAULT_CONFIG: CcstatConfig = {
  TOKEN_LIMIT: 60000000, // 60M tokens
  OBSERVED_MAX_TOKEN: 0,
  USE_OBSERVED_IF_HIGHER: true,
};

/**
 * Load ccstat.json configuration file
 * Creates default config if file doesn't exist
 */
export async function loadConfig(): Promise<CcstatConfig> {
  try {
    if (!existsSync(CONFIG_FILE_PATH)) {
      // Create default config file
      await saveConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }

    const content = await readFile(CONFIG_FILE_PATH, "utf8");
    const config = JSON.parse(content) as any;

    // Validate required fields and provide defaults
    return {
      TOKEN_LIMIT: config.TOKEN_LIMIT ?? DEFAULT_CONFIG.TOKEN_LIMIT,
      OBSERVED_MAX_TOKEN:
        config.OBSERVED_MAX_TOKEN ?? DEFAULT_CONFIG.OBSERVED_MAX_TOKEN,
      USE_OBSERVED_IF_HIGHER:
        config.USE_OBSERVED_IF_HIGHER ??
        config.USEOBSERVED ??
        DEFAULT_CONFIG.USE_OBSERVED_IF_HIGHER,
    };
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
    console.log(
      `📈 Updated OBSERVED_MAX_TOKEN: ${config.OBSERVED_MAX_TOKEN.toLocaleString()} → ${blockTotal.toLocaleString()}`,
    );
    return updatedConfig;
  }
  return config;
}
