# DevEnv Preflight

**System-aware environment intelligence layer for AI coding agents.**

Provides a structured JSON snapshot of a developer's local environment and validates it against declarative stack requirements (e.g., Spring Boot, Node.js). This prevents agents from running blind CLI probing loops.

## Packages

| Package | Description |
|---|---|
| `@devenv-preflight/core` | Detectors, validators, and schema definitions |
| `@devenv-preflight/cli` | Universal CLI wrapper |
| `@devenv-preflight/mcp` | Model Context Protocol server |
| `@devenv-preflight/setup` | Zero-config agent installer |

## Quick Start

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run environment scan via CLI
node packages/cli/dist/index.js scan --pretty

# Validate against a stack
node packages/cli/dist/index.js validate --stack node-fullstack --pretty

# Validate and show fix recommendations
node packages/cli/dist/index.js validate --stack spring-boot --pretty --fixes

# Auto-register MCP server with detected AI agents
node packages/setup/dist/index.js

# Preview what setup would do (no writes)
node packages/setup/dist/index.js --dry-run
```

## MCP Tools

The MCP server (`@devenv-preflight/mcp`) exposes three tools for AI agents:

| Tool | Description |
|---|---|
| `scan_environment` | Returns a full environment snapshot (no arguments) |
| `validate_stack` | Validates environment against a stack ID |
| `recommend_fixes` | Returns a fix plan for a stack that fails validation |

## Supported Agents (setup)

`@devenv-preflight/setup` auto-detects and configures:

- **Claude Code** — `~/.claude.json`
- **Cursor** — `~/.cursor/mcp.json`
- **Windsurf** — `~/.codeium/windsurf/mcp_config.json`

## Available Stacks

| Stack ID | Description |
|---|---|
| `node-fullstack` | Node.js ≥18, npm ≥9, git ≥2.30 |
| `spring-boot` | Java ≥17, Maven ≥3.8, git ≥2.30 |
| `agent-push-eval` | git ≥2.30 with push capability assessment |

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full type taxonomy, permission model, and data flow.

## License

MIT
