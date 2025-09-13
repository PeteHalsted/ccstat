import { homedir } from "node:os";
import { xdgConfig } from "xdg-basedir";

/**
 * User's home directory path
 */
export const USER_HOME_DIR = homedir();

/**
 * XDG config directory path
 */
const XDG_CONFIG_DIR = xdgConfig ?? `${USER_HOME_DIR}/.config`;

/**
 * Default Claude Code path (legacy location)
 */
export const DEFAULT_CLAUDE_CODE_PATH = ".claude";

/**
 * Default Claude config path (new XDG location)
 */
export const DEFAULT_CLAUDE_CONFIG_PATH = `${XDG_CONFIG_DIR}/claude`;

/**
 * Environment variable for custom Claude config directory
 */
export const CLAUDE_CONFIG_DIR_ENV = "CLAUDE_CONFIG_DIR";

/**
 * Projects directory name within Claude data directory
 */
export const CLAUDE_PROJECTS_DIR_NAME = "projects";

/**
 * Glob pattern for finding usage data JSONL files
 */
export const USAGE_DATA_GLOB_PATTERN = "projects/**/*.jsonl";

/**
 * Default session duration in hours (Claude's billing block duration)
 */
export const DEFAULT_SESSION_DURATION_HOURS = 5;

/**
 * Maximum context tokens for Claude
 */
export const MAX_CONTEXT_TOKENS = 200000;

/**
 * Maximum block minutes (5 hours)
 */
export const MAX_BLOCK_MINUTES = 300;

/**
 * Projected token limit for quota warnings (adjusted to match our data aggregation)
 */
export const PROJECTED_TOKEN_LIMIT = 101685800;

/**
 * Threshold percentage for showing usage warnings (80%)
 */
export const BLOCKS_WARNING_THRESHOLD = 0.8;
