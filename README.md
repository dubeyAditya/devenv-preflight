# DevEnv Preflight

**System-aware environment intelligence layer for AI coding agents.**

Provides a structured JSON snapshot of a developer's local environment and validates it against declarative stack requirements. Prevents agents from running blind CLI probing loops, asking redundant questions, or generating code that silently breaks on the user's machine.

---

## Why This Exists

Every AI coding agent starts a session knowing nothing about your machine. Without preflight, the agent discovers the environment through failure:

| Scenario | Without preflight | With preflight |
|---|---|---|
| Agent writes Node 18+ code, user has Node 14 | Build fails → agent investigates → suggests upgrade → user acts → retry | Agent knows Node 14 upfront, warns before writing code |
| Agent assumes Docker daemon is running | `docker run` fails → 3-turn debug loop | Agent sees `docker: installed: true, context: not running` immediately |
| Agent tries `gh pr create`, gh not installed | Error → investigation → "please install gh" → user acts → retry | Agent suggests install at the start |
| Python version mismatch for a pip package | Silent import error → 20 min triage | Agent matches package to detected Python 3.x |
| AWS CLI not configured | Deployment fails with cryptic auth error | Agent flags missing profile before writing deploy scripts |
| git push blocked (no remote write access) | Script committed, push fails | Agent knows push access state via privileged tier |

**Estimated overhead without preflight per developer per week:**
- 2–4 environment-related back-and-forth loops
- 10–30 min per loop (failed run → investigation → fix suggestion → retry)
- **1–2 hours/week per developer** on pure environment noise
- For a 5-person team: **250–500 hours/year** of recoverable waste
- For AI agents: each loop burns 3–6 conversation turns at real token cost

Preflight collapses this to a single upfront scan that takes under 500 ms.

---

## Packages

| Package | Description |
|---|---|
| `@devenv-preflight/core` | Detectors, validators, cache, and schema definitions |
| `@devenv-preflight/cli` | Universal CLI (`scan`, `validate`) |
| `@devenv-preflight/mcp` | MCP server exposing `scan_environment`, `validate_stack`, `recommend_fixes` |
| `@devenv-preflight/setup` | Zero-config installer — detects agent and writes MCP config |
| `@devenv-preflight/skill` | Claude Code / Cursor / Gemini CLI skill (`/devenv-preflight`) |

---

## Quick Start

```bash
npm install && npm run build

# Scan the local environment
node packages/cli/dist/index.js scan --pretty

# Validate against a stack
node packages/cli/dist/index.js validate --stack node-fullstack --pretty

# Show fix recommendations for a failing stack
node packages/cli/dist/index.js validate --stack spring-boot --pretty --fixes

# Auto-register MCP server with detected AI agents (Claude Code, Cursor, Windsurf)
node packages/setup/dist/index.js

# Preview what setup would do
node packages/setup/dist/index.js --dry-run
```

---

## Agent Integration

### Claude Code

#### Option A — Skill (slash command + auto MCP config)

```bash
# Step 1: wire up the MCP server once
node packages/setup/dist/index.js

# Step 2: install the skill
npx skills add dubeyAditya/preflight
```

This registers `/devenv-preflight` as a slash command. Invoking it runs the guided scan → validate → fix flow. The `mcp.json` bundled in the skill auto-configures the MCP server for agents that read it.

#### Option B — Hooks (automatic, zero invocation)

Add to `.claude/settings.json` (project) or `~/.claude/settings.json` (global):

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "mcp_tool",
        "server": "devenv-preflight",
        "tool": "scan_environment",
        "input": {},
        "statusMessage": "Running preflight scan...",
        "timeout": 25
      }]
    }],
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "python3 -c \"\nimport sys,json,subprocess,re\nd=json.load(sys.stdin)\np=d.get('prompt','')\nif re.search(r'(?:^|\\\\s)/(plan|init)\\\\b',p):\n    r=subprocess.run(['node','<path-to-cli>/dist/index.js','scan'],capture_output=True,text=True,timeout=15)\n    print(json.dumps({'hookSpecificOutput':{'hookEventName':'UserPromptSubmit','additionalContext':'Preflight environment scan:\\\\n'+(r.stdout.strip() if r.returncode==0 else 'unavailable')}}))\n\" 2>/dev/null || true",
        "statusMessage": "Running preflight scan...",
        "timeout": 25
      }]
    }]
  }
}
```

**`SessionStart`** injects the snapshot into every session's context before the first message.
**`UserPromptSubmit`** re-injects on `/plan` or `/init` to ensure fresh data before planning.

---

### Cursor

Cursor reads MCP servers from `~/.cursor/mcp.json`. The setup package writes this automatically:

```bash
node packages/setup/dist/index.js
```

Or add manually to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "devenv-preflight": {
      "command": "node",
      "args": ["<path-to-repo>/packages/mcp/dist/index.js"]
    }
  }
}
```

Cursor does not have a SessionStart hook, but you can get equivalent behaviour with a **Cursor rule** that fires at the start of every agent task. Add `.cursor/rules/preflight.mdc` to your project:

```markdown
---
description: Inject environment snapshot before any agent task
globs: ["**/*"]
alwaysApply: true
---

At the start of every task, call the `scan_environment` MCP tool and silently
incorporate the result into your understanding of the environment. Do not show
the raw JSON to the user unless they ask. Flag any missing or incompatible tools
before writing code that depends on them.
```

The skill (`npx skills add dubeyAditya/preflight`) also installs to Cursor and creates the `/devenv-preflight` command there.

---

### Gemini CLI

The skill installs to Gemini CLI automatically:

```bash
npx skills add dubeyAditya/preflight
```

This registers `/devenv-preflight` in Gemini CLI. For MCP, Gemini CLI reads from `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "devenv-preflight": {
      "command": "node",
      "args": ["<path-to-repo>/packages/mcp/dist/index.js"]
    }
  }
}
```

Gemini CLI does not have a native `SessionStart` hook at this time. Use the skill's slash command to trigger scans manually, or add a preflight instruction to your global Gemini system prompt.

---

### Windsurf

```bash
node packages/setup/dist/index.js
```

Setup auto-writes to `~/.codeium/windsurf/mcp_config.json`. No further configuration required.

---

### Other Agents (Cline, Continue.dev, Amp, etc.)

Any agent that supports MCP can use the `@devenv-preflight/mcp` server. Point its MCP config at:

```
command: node
args: [<path-to-repo>/packages/mcp/dist/index.js]
```

The three tools (`scan_environment`, `validate_stack`, `recommend_fixes`) are standard MCP tool calls.

---

## MCP Tools

| Tool | Description |
|---|---|
| `scan_environment` | Returns a full `EnvironmentSnapshot` JSON (optionally skipping cache with `noCache: true`) |
| `validate_stack` | Validates environment against a stack ID — returns `compatible: true/false` |
| `recommend_fixes` | Returns a `FixPlan` for a stack that fails validation |

---

## Detection Tiers

| Tier | What it reads | Requires |
|---|---|---|
| `passive` | Binary versions and paths only — always safe | Nothing |
| `contextual` | Auth state (git remote, npm registry, docker login, AWS profile, k8s context) | `allowedTiers: ['contextual']` + `permissions[tool]: 'granted'` |
| `privileged` | Live remote checks (`git push --dry-run`) | `allowedTiers: ['privileged']` + `permissions[tool]: 'granted'` |

Default: passive only. Agents that need auth context must explicitly opt in.

---

## Available Stacks

| Stack ID | Description |
|---|---|
| `node-fullstack` | Node.js ≥18, npm ≥9, git ≥2.30 |
| `spring-boot` | Java ≥17, Maven ≥3.8, git ≥2.30 |
| `python-ml` | Python ≥3.9 |
| `agent-push-eval` | git ≥2.30 with push access (privileged tier) |

---

## Caching

Scan results are cached at `~/.devenv-preflight/cache.json` with a 60-second TTL by default. This prevents repeated subprocess spawns on every message in a long session.

```bash
# Force fresh scan (bypasses cache)
node packages/cli/dist/index.js scan --no-cache

# Set a custom TTL (seconds)
node packages/cli/dist/index.js scan --ttl 300
```

---

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full type taxonomy, permission model, and data flow.

## License

MIT
