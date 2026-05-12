# Architecture

## Overview

DevEnv Preflight produces two JSON outputs:

1. **EnvironmentSnapshot** — a structured snapshot of all detected tools, grouped by category
2. **CompatibilityReport** — a pass/fail report against a named stack definition, plus a **FixPlan** of remediation suggestions

All outputs include `meta.schemaVersion` (`"0.1.0"`) for forward compatibility.

## Type Taxonomy

### ToolCategory

How tools are grouped in the snapshot:

| Category | Snapshot field | Examples |
|---|---|---|
| `language` | `toolchains` | node, python, java |
| `package-manager` | `packageManagers` | npm, brew |
| `version-manager` | `versionManagers` | nvm, pyenv |
| `vcs` | `vcs` | git, gh (GitHub CLI), glab (GitLab CLI) |
| `infra` | `infra` | docker, kubectl |
| `system` | _(unmapped)_ | curl, make |
| `build-tool` | _(unmapped)_ | webpack, vite |

`system` and `build-tool` are valid `ToolCategory` values but have no snapshot field in Phase 1. Detectors using these categories are silently skipped by `scanner.ts`.

### DetectionTier

Controls when a detector runs and what permissions it requires:

| Tier | Meaning | Phase 1 |
|---|---|---|
| `passive` | Read-only, no auth, always safe | All detectors |
| `contextual` | Reads auth context (e.g. `kubectl config`) | Phase 2+ |
| `privileged` | Hits remote APIs, requires explicit opt-in | Phase 2+ |

`scanEnvironment()` defaults to `allowedTiers: ['passive']`. Non-passive detectors must be explicitly enabled via `ScanOptions` and will only run if `permissions[tool] === 'granted'`.

## Data Flow

```
scanEnvironment(options?)
  └─ filters ALL_DETECTORS by tier + permissions
  └─ runs detector.detect(platform) in parallel
  └─ groups results by CATEGORY_TO_FIELD map
  └─ returns EnvironmentSnapshot

loadStack(stackId)              ← reads stacks/<id>.json from repo root
validateStack(snapshot, stack)  ← semver comparison per requirement
recommendFixes(report)          ← suggestions for missing + incompatible tools
```

## Permission Model

```
ScanOptions.allowedTiers   — whitelist of tiers to run (default: ['passive'])
ScanOptions.permissions    — per-tool overrides:
  'granted'       → required for non-passive detectors to run
  'denied'        → skips the detector regardless of tier
  'not-requested' → default; non-passive detectors skip unless granted
```

## Stack Definitions

Stack files live in `stacks/*.json`. The `id` field must match the filename:

```json
{
  "id": "node-fullstack",
  "name": "Node.js Full-Stack",
  "description": "Next.js / Express with npm and Git",
  "requirements": [
    { "tool": "node", "versionRange": ">=18.0.0", "required": true },
    { "tool": "npm",  "versionRange": ">=9.0.0",  "required": true },
    { "tool": "git",  "versionRange": ">=2.30.0", "required": true }
  ]
}
```

`tool` must match a detector `name` in `ALL_DETECTORS`. `versionRange` is a semver range evaluated with the `semver` package. `required: false` demotes failures to notes rather than blocking compatibility.

## Package Dependency Graph

```
cli   → core
mcp   → core
setup → (standalone, no core dependency)
```

`setup` is intentionally standalone — it only reads/writes config files and does not import any detection logic.
