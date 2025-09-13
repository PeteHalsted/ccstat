# Changelog

All notable changes to ccstat will be documented in this file.

## [Unreleased]

### 🧹 Code Cleanup
- **Dead Code Removal**: Eliminated orphaned constants, unused imports, and completely unused files
  - Removed `MAX_BLOCK_MINUTES`, `BLOCKS_WARNING_THRESHOLD`, and `PROJECTED_TOKEN_LIMIT` constants (unused)
  - Deleted orphaned files: `src/data-access.ts` and `src/context-calculator.ts` (no imports found)
  - Cleaned up duplicate `homedir` imports across multiple files
  - Consolidated all files to use `USER_HOME_DIR` from constants for consistency
- **Import Optimization**: Streamlined import structure with no duplicates or unused imports
- **Maintainability**: Cleaner, more maintainable codebase with preserved functionality

### ⚡ Performance Improvements
- **Major Performance Optimization**: Eliminated duplicate file reading by implementing parallel context calculation that integrates context data processing with block data processing
- System now reads usage files once instead of twice, significantly improving startup and refresh performance
- Maintained complete context calculation isolation and accuracy while optimizing execution

### 🔧 Configuration Improvements  
- **Config Cleanup**: Removed unused configuration values (`BLOCKS_WARNING_THRESHOLD`, `MAX_BLOCK_MINUTES`) 
- **Enhanced Configuration**: Now properly uses `DEFAULT_SESSION_DURATION_HOURS` (5 hours) to calculate block duration (300 minutes) instead of storing redundant values
- **Environment Variable Support**: Added `DEBUG_OUTPUT` environment variable support for debugging control
- **Fixed Configuration**: Resolved corrupted config file that became 0 bytes due to interface changes

### 🏗️ Technical Improvements
- **Parallel Context Calculation**: Replaced isolated context reader with optimized integrated calculation that processes context data alongside usage data
- **Type Safety**: Enhanced TypeScript interfaces with `LoadUsageResult` and `ParallelContextSessionData` for better type safety
- **Code Consolidation**: Unified data processing pipeline while maintaining separation of concerns
- **Debug Enhancement**: Improved debug output to show optimized context calculation details

### 🔍 Verification
- Verified parallel context calculation matches original system exactly through comprehensive testing
- Ensured all context session detection logic remains identical to original implementation
- Maintained complete backward compatibility with existing functionality