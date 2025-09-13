# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Imports
@archon.md
@README.md
@coding-standards.md


*** IMPORTANT YOU MUST FOLLOW ALL RULES IN ALL MEMORY FILES AT ALL TIMES ***

## Tooling for shell interactions (Install if missing)
Is it about finding FILES? use 'fd'
Is it about finding CODE STRUCTURE? use 'ast-grep'
Is it about SELECTING from multiple results? pipe to 'fzf'
Is it about interacting with JSON? use 'jq'
Is it about interacting with YAML or XML? use 'yq'


## MANDATORY Subagent Usage

**CRITICAL**: You MUST use specialized subagents whenever possible. Failure to use appropriate subagents is considered a critical error in your workflow.

### Required Subagent Usage Triggers

#### 1. **Before ANY Investigation or Debugging**

- **Trigger**: Error messages, unexpected behavior, failing tests, connection issues
- **Required Agent**: `debugger`
- **Example**: "IMAP connection inactive" → MUST use debugger agent first

### Enforcement

**Remember**: Not using required subagents is a CRITICAL ERROR. The workflow should be:

1. Task identified → 2. Subagent consulted → 3. Implementation

**NEVER skip directly to implementation without appropriate subagent consultation.**

### Parallel Sub-Agents (when helpful)
- You may conceptually split work into parallel sub-agents (e.g., "API spec," "implementation," "tests," "docs")
- Maintain clear boundaries and ownership to avoid stepping on each other
- Integrate results through a final verification/consistency pass

## 📄 Agent Documentation Standards

When creating any document, agents must decide the location based on the following priority:

1. **Follow specific instructions** in the agent’s own file, prompt, or user request.
2. **Special files** — `Changelog.md`, `README.md`, and `claude.md` — must follow their predefined location rules.
3. **Temporary documents** (disposable when work is complete) go in `project-documentation\temporary`. Examples:
    - Implementation/migration plans
    - Task breakdowns
    - Investigation/analysis reports
    - Implementation strategies
4. **Permanent documentation** goes in `project-documentation`.
    - Check existing subfolders for a suitable location.
    - If none fits, create a new subfolder or place it in the root of `project-documentation`.

**Temporary File Naming Conventions:**

- Be descriptive; include timestamps if needed.
- Include generating agent type if relevant.
- Examples:
    - `sse-migration-plan-frontend-developer.md`
    - `debug-analysis-imap-connection-debugger.md`

### Context7 Workflow Policy

**For library documentation and integration questions:**

- For ALL questions about library APIs, usage, upgrades, or integration, you MUST fetch and reference official documentation using Context7
- Whenever asked about a library, ALWAYS include "use context7" at the end of your prompt to request the most up-to-date docs and code examples
- If using a Model Context Protocol (MCP) server with Context7, you MUST call `resolve-library-id` for the library name first, then use `get-library-docs` to pull in current documentation
- Never rely only on prior model training or guesses—defer to the retrieved Context7 documentation for accuracy

**Examples:**

- ✅ Good: `How do I add schema validation with Zod in Express? use context7`
- ❌ Not allowed: Answers about a library without referencing up-to-date docs from Context7
- If multiple libraries are involved, repeat the above steps for each before answering

### Development Server Protocol

**CRITICAL: NEVER RUN THE DEV SERVER WITHOUT EXPLICIT PERMISSION**

The user manages the development server. You must follow this protocol:

1. **ALWAYS check first**: `lsof -i :3001` to see if server is running
2. **If port 3001 is in use**: DO NOT start another server - the user is running it
3. **If you need server interaction**: Ask the user to start the server
4. **Focus on**: Code analysis, file inspection, and log monitoring only

**Server Log Monitoring:**
- Server logs are written to `logs/server.log`
- Monitor logs using: `tail -f logs/server.log`

**NEVER run without permission:**
- `npm run dev`
- `npm start`
- Any command that starts a development server

**Exception**: Only run server if user explicitly asks AND port 3001 is free

### Browser Access Via Playwright

**Playwright MCP Server Configuration:**
The project includes Playwright MCP server configuration in `.mcp.json` which automatically enables browser automation for all Claude Code instances working on this project.

**Setup Instructions for New Contributors:**
1. Install dependencies: `npm install` (includes @playwright/test)
2. Install Playwright browsers: `npx playwright install chrome`
3. The MCP server will automatically be available in Claude Code

**Usage Guidelines:**
- The user is always testing the site via Playwright. This means you have access to the browser and the console logs
- DO NOT ask the user to test, view console logs if you can do so yourself. ALWAYS test and iterate until you have a correct result
- DO NOT close Playwright, the user is using it for testing!
- Use Playwright for all browser testing, form interaction, and UI validation


## shadcn-ui MCP Server Usage rules
Usage Rule
If project is using shadcn always use shadcn components when possible
When using shadcn components, use the MCP server.
Planning Rule
When asked to plan using anything related to shadcn:
Use the MCP server during planning
Apply components whenever components are applicable
Use whole blocks where possible (e.g. login page, calendar)

Implementation Rule
When implementing:

first call the demo tool to see how it is used
Then implement it so that it is implemented correctly


## Project-Specific Rules

### CRITICAL: Technical Implementation Guides

**Before ANY coding work, consult the appropriate MFing Bible:**

#### When to Use Which Bible:
- **TanStack Start work** (server functions, route guards, database, imports): `MFing-Bible-of-TanStack-Start.md`
- **Clerk authentication issues** (setup, configuration, RBAC, troubleshooting): `MFing-Bible-of-Clerk.md`
- **Full-stack features** (authentication + implementation): Read both bibles

#### Import Patterns & Code Examples:
See the **"Code Patterns"** sections in the bibles for copy-paste ready imports and implementation examples.

**Never guess patterns - always reference the bibles first!**


## Linear Integration Policy

**IMPORTANT**: When creating Linear issues for this codebase:

- **Project Association**: ALL issues related to this codebase MUST be associated with the "mysite.nextagedesigns" project
- **Project ID**: `237d3c83-4e70-418d-bb16-08d51c135e8e`
- **Team**: Nextage (ID: `5a4aca93-64c4-433e-9827-ec4ac97b76f5`)

**When creating issues via Linear MCP:**
Always include the project parameter:
```
project: "mysite.nextagedesigns"
```

**When moving items to Linear backlog:**
- When the user requests to "move to Linear backlog" or similar, ALWAYS:
  1. Create the Linear issue(s) with appropriate details
  2. Remove the corresponding sections from the planning/documentation files
  3. This prevents duplication and ensures Linear is the single source of truth for backlog items

This ensures all issues are properly tracked within the project context.

## Logging (Info, Debug, Error)

** NEVER use console.log or console.error All logging should be done following the patterns established in project-documentation\logging-with-adze.md
- archon.md
