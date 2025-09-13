# ccstat-acp

A Claude Code usage status monitor that provides real-time monitoring of Claude API usage, context consumption, and token burn rates. While it creates concise status line style output for general use, it was specifically created to allow monitoring Claude Code context and usage when using it as an External Agent via ACP (Agent Client Protocol) in Zed Editor.

![ccstat in action](assets/screenshot.png)

## Installation

### Via npm (Recommended)

```bash
npm install -g ccstat-acp
```

After installation, you can run the monitor from anywhere:

```bash
ccstat-acp
```

### Via npx (No Installation)

Run without installing:

```bash
npx ccstat-acp
```

## Features

- **Real-time monitoring** of Claude usage with 1-second updates
- **Billing-aware sessions** aligned with Claude's 5-hour billing blocks
- **Context tracking** with project-specific context usage (especially useful for ACP sessions)
- **Burn rate alerts** with configurable thresholds
- **Progress indicators** for time and token usage
- **Git integration** showing current branch and directory
- **Configurable thresholds** for warnings and alerts
- **ACP-optimized** for monitoring External Agent usage in Zed Editor

## Usage

Simply run the command in any directory:

```bash
ccstat-acp
```

The monitor will display:
- ⏰ Time remaining in current billing block
- 🧠 Context usage for current project
- 🔥 Burn rate indicator (Normal/Moderate/High)
- Usage percentages and projections

### ACP/Zed Editor Usage

When using Claude Code as an External Agent in Zed Editor via ACP, this monitor becomes especially valuable for:
- Tracking context consumption in real-time as you work
- Monitoring token usage during extended coding sessions
- Getting early warnings before hitting context or billing limits
- Understanding usage patterns when Claude Code is integrated into your editor workflow

## Configuration

Configuration is stored in `~/.config/ccstat.json` with these options:

```json
{
  "TOKEN_LIMIT": 60000000,
  "CONTEXT_RESERVED": 15,
  "BURN_RATE_HIGH_THRESHOLD": 1000,
  "BURN_RATE_MODERATE_THRESHOLD": 500,
  "REFRESH_INTERVAL_MS": 1000
}
```

### Key Configuration Options

- `CONTEXT_RESERVED`: Percentage of context to reserve (default: 15%)
- `BURN_RATE_*_THRESHOLD`: Token usage rate thresholds (tokens/minute)
- `*_WARNING_THRESHOLD`: Warning levels for time/usage percentages
- `DEBUG_OUTPUT`: Enable detailed debug information

## Requirements

- Node.js 18 or higher
- Claude Code with usage data in `~/.config/claude/projects/`
- For ACP monitoring: Claude Code configured as External Agent in Zed Editor

## Development

```bash
# Clone and install
git clone https://github.com/PeteHalsted/ccstat.git
cd ccstat
npm install

# Build and run
npm run build
npm start

# Development with auto-rebuild
npm run dev

# Code quality
npm run check:fix
```

## Attribution

This project contains code derived from [ccusage](https://github.com/ryoppippi/ccusage) by ryoppippi, licensed under the MIT License.

## License

MIT License - see [LICENSE](LICENSE) file for details.
