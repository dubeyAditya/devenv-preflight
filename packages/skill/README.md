# preflight — Claude Code skill

Scan and validate your local developer environment from inside Claude Code.

## How it works

This skill has two parts:

| Part | What it does | How it's installed |
|---|---|---|
| **SKILL.md** | Teaches the AI the scan → validate → fix flow | `npx skills add dubeyAditya/preflight` |
| **MCP server** | Provides the actual tools (`scan_environment` etc.) | `npx @devenv-preflight/setup` |

Both parts are required. The skill without the MCP server loads but has no tools to call.

## Install

### Step 1 — MCP server (tools)

```bash
npx @devenv-preflight/setup
```

This auto-detects your agent environment and writes the MCP config. Run once per machine.

### Step 2 — Skill (instructions)

```bash
npx skills add dubeyAditya/preflight
```

Registers the `/devenv-preflight` slash command. Agents that support `mcp.json` (Claude Code, Cursor) will also pick up the MCP config automatically from the skill package.

## Usage

```
/devenv-preflight
```
Full scan with automatic stack inference → validation → fix suggestions.

```
/devenv-preflight validate node-fullstack
```
Validate directly against a specific stack.

```
/devenv-preflight scan
```
Raw environment snapshot only.

## Available stacks

| Stack ID | Description |
|---|---|
| `node-fullstack` | Node.js ≥18, npm, git |
| `spring-boot` | Java ≥17, Maven or Gradle |
| `python-ml` | Python ≥3.9 |
| `agent-push-eval` | git ≥2.30 with push access (privileged tier) |

## Advanced: contextual and privileged tiers

The MCP `scan_environment` tool supports `allowedTiers` and `permissions` for richer context:

- **contextual** — reads auth state (git remote, npm registry, docker login, AWS profile)
- **privileged** — verifies live push access via `git push --dry-run`

## Source

Skill source lives in [GitLab](https://gitlab.com/dubey_aditya/devenv-preflight) under `packages/skill/`.
Published to [github.com/dubeyAditya/preflight](https://github.com/dubeyAditya/preflight) on each release tag.
