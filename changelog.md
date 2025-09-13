# Changelog

All notable changes to ccstat-acp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **BREAKING**: Renamed package from "ccstat" to "ccstat-acp" for npm publication
- Removed all references to "standalone" terminology from codebase and documentation
- Updated CLAUDE.md to reflect new package name and cleaner project overview
- Cleaned up .gitignore to ignore CLAUDE.md (development-only file)

### Added
- LICENSE file with MIT license and attribution to ccusage project
- README.md with comprehensive usage instructions and npm installation guide
- PUBLISHING.md with detailed npm publishing workflow documentation
- .npmignore file to properly exclude development files from npm package
- assets/ directory prepared for screenshots and documentation assets
- package-lock.json updated for new package name

### Removed
- archon.md (Archon-specific documentation no longer needed)
- coding-standards.md (integrated into main workflow)
- .mcp.json (development-specific MCP configuration)
- Legacy changelog.md (recreated with proper structure)

### Fixed
- Package configuration now properly prepared for npm publishing
- All internal references updated to use new "ccstat-acp" package name
- Documentation structure simplified and focused on end-user needs

## Notes

This release prepares the package for its first npm publication under the name "ccstat-acp". The package provides Claude Code usage monitoring with specific optimizations for ACP (Agent Client Protocol) usage in editors like Zed.