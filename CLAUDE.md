# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Claude Code usage status monitor** (`ccstat-acp`) - a TypeScript CLI tool that provides real-time monitoring of Claude API usage, context consumption, and token burn rates. It's designed as a command-line status display that continuously updates to show current usage patterns.

## Development Commands

### Build and Run
```bash
npm run build          # Compile TypeScript to dist/
npm run start          # Run compiled version
npm run dev            # Build and run in one command
npm run clean          # Remove dist/ directory
```

### Code Quality
```bash
npm run lint           # Lint source code with Biome
npm run lint:fix       # Auto-fix linting issues
npm run format         # Check formatting with Biome  
npm run format:fix     # Auto-fix formatting issues
npm run check          # Run both linting and formatting checks
npm run check:fix      # Auto-fix both linting and formatting
```

**Important**: Always run `npm run check:fix` before committing to ensure code quality standards.

## Architecture Overview

### Core Components

**Main Entry Point** (`src/index.ts`):
- CLI application that displays real-time status in terminal
- Manages the main monitoring loop with configurable refresh intervals
- Handles terminal output with color coding and progress bars
- Integrates git branch detection and directory display

**Configuration System** (`src/config.ts`):
- XDG-compliant configuration with migration from legacy locations
- JSON-based config file (`~/.config/ccstat.json`)
- Supports observed maximum tracking with automatic updates
- Configurable thresholds for warnings and alerts

**Data Loading** (`src/data-loader.ts`):
- Reads Claude usage data from JSONL files in `~/.config/claude/projects/`
- Implements exact data validation schemas copied from ccusage
- Provides parallel context calculation for real-time context tracking
- Handles deduplication using message ID + request ID combinations

**Session Management** (`src/session-blocks.ts`):
- Groups usage entries into 5-hour billing blocks (Claude's billing model)
- Detects active sessions and calculates burn rates
- Handles gap detection between usage periods
- Provides projection calculations for remaining session time

**Constants** (`src/constants.ts`):
- Centralized configuration values and file paths
- XDG Base Directory compliance for config locations

### Key Architectural Patterns

1. **Real-time Monitoring**: Continuous loop updates every second by default
2. **Billing-aware Sessions**: 5-hour blocks aligned with Claude's billing model
3. **Context Awareness**: Project-specific context tracking based on directory structure
4. **Progressive Enhancement**: Graceful handling of missing data or configuration
5. **Terminal UI**: Color-coded status display with progress bars

### Data Flow

1. **Load Configuration**: Read from `~/.config/ccstat.json` or create defaults
2. **Scan Usage Data**: Read recent JSONL files from Claude's project directories  
3. **Process Sessions**: Group entries into 5-hour billing blocks
4. **Calculate Context**: Determine active project context from current directory
5. **Project Metrics**: Calculate burn rates, projections, and usage percentages
6. **Display Status**: Render color-coded terminal output with progress indicators

### Configuration Management

The tool uses XDG Base Directory specification for configuration:
- Primary: `~/.config/ccstat.json`
- Legacy: `~/ccstat.json` (automatically migrated)

Key configuration categories:
- **Token Limits**: Configurable with observed maximum tracking
- **Burn Rate Thresholds**: Warning levels for usage velocity
- **Display Settings**: Refresh intervals and debug output
- **Alert Thresholds**: Percentage-based warnings for time/usage

### Build Configuration

- **TypeScript**: ES2022 target with ESNext modules
- **Biome**: Linting and formatting with tabs, 100-character line width
- **Dependencies**: Minimal runtime dependencies (es-toolkit, zod, xdg-basedir)
- **Output**: Single executable in `dist/index.js` with shebang for CLI usage