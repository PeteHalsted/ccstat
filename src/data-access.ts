/**
 * READ-ONLY DATA ACCESS LAYER
 *
 * This module provides controlled access to context calculation data.
 * All data returned is immutable to prevent accidental modifications.
 * Only the isolated context calculator can modify the underlying data.
 */

import {
  isolatedContextCalculator,
  ISOLATED_CONTEXT_CONSTANTS,
  type ReadOnlyUsageEntry,
  type ReadOnlySessionData,
  type ReadOnlySessionBlock,
  type ReadOnlyBurnRate,
  type ReadOnlyProjectedUsage,
  type ReadOnlyTokenCounts
} from './context-calculator.js';

/**
 * READ-ONLY DATA ACCESS API
 * All methods return immutable data to prevent accidental modifications
 */
export class ReadOnlyDataAccess {
  /**
   * Load usage entries - returns immutable data
   * PROTECTED: Cannot be modified after return
   */
  async getUsageEntries(): Promise<readonly ReadOnlyUsageEntry[]> {
    return await isolatedContextCalculator.loadUsageEntries();
  }

  /**
   * Get aggregated session data - returns immutable data
   * PROTECTED: Cannot be modified after return
   */
  async getSessionData(): Promise<readonly ReadOnlySessionData[]> {
    return await isolatedContextCalculator.aggregateSessionData();
  }

  /**
   * Get session blocks - returns immutable data
   * PROTECTED: Cannot be modified after return
   */
  getSessionBlocks(entries: readonly ReadOnlyUsageEntry[]): readonly ReadOnlySessionBlock[] {
    return isolatedContextCalculator.identifySessionBlocks(entries);
  }

  /**
   * Calculate burn rate - returns immutable data
   * PROTECTED: Pure function with no side effects
   */
  getBurnRate(block: ReadOnlySessionBlock): ReadOnlyBurnRate | null {
    return isolatedContextCalculator.calculateBurnRate(block);
  }

  /**
   * Project block usage - returns immutable data
   * PROTECTED: Pure function with no side effects
   */
  getProjectedUsage(block: ReadOnlySessionBlock): ReadOnlyProjectedUsage | null {
    return isolatedContextCalculator.projectBlockUsage(block);
  }

  /**
   * Get total tokens - returns number
   * PROTECTED: Pure function with no side effects
   */
  getTotalTokens(tokenCounts: ReadOnlyTokenCounts): number {
    return isolatedContextCalculator.getTotalTokens(tokenCounts);
  }

  /**
   * Get isolated constants - returns immutable constants
   * PROTECTED: Cannot be modified
   */
  getConstants() {
    return ISOLATED_CONTEXT_CONSTANTS;
  }

  /**
   * Filter entries by date - returns immutable data
   * PROTECTED: Does not modify original data
   */
  filterEntriesSince(entries: readonly ReadOnlyUsageEntry[], sinceDate: Date): readonly ReadOnlyUsageEntry[] {
    return Object.freeze(entries.filter(entry => entry.timestamp >= sinceDate));
  }

  /**
   * Find active session block - returns immutable data
   * PROTECTED: Does not modify original data
   */
  findActiveBlock(blocks: readonly ReadOnlySessionBlock[]): ReadOnlySessionBlock | undefined {
    return blocks.find(block => block.isActive);
  }

  /**
   * Find session by path - returns immutable data
   * PROTECTED: Does not modify original data
   */
  findSessionByPath(sessions: readonly ReadOnlySessionData[], currentPath: string): ReadOnlySessionData | null {
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
}

// Export singleton instance to ensure consistent access
export const readOnlyDataAccess = Object.freeze(new ReadOnlyDataAccess());

// Re-export types for convenience (all read-only)
export type {
  ReadOnlyUsageEntry,
  ReadOnlySessionData,
  ReadOnlySessionBlock,
  ReadOnlyBurnRate,
  ReadOnlyProjectedUsage,
  ReadOnlyTokenCounts
};
