# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

DevEnv Preflight is a TypeScript monorepo that provides structured JSON snapshots of a developer's local environment and validates them against declarative stack requirements. It exists so AI coding agents can understand what tools are available without running blind CLI probing loops. All Phase 1 operations are strictly read-only.

## Commands

```bash
npm install             # Install all workspace dependencies
npm run build           # Build all packages (tsc across workspaces)
npm test                # Run tests (jest with ts-jest, --passWithNoTests)
npm run lint            # ESLint across all packages
npm run clean           # Remove all dist/ directories
```

Run a single test file: `npx jest packages/core/__tests__/some.test.ts`

Tests live in `packages/<pkg>/__tests__/*.test.ts` and must match the `**/__tests__/**/*.test.ts` glob.

## Architecture

Four npm workspace packages, all under `packages/`:

- **`@devenv-preflight/core`** — The engine. Types, detectors, scanner, validator, executor. Everything else depends on this.
- **`@devenv-preflight/cli`** — CLI wrapper using `commander`. Provides `scan` and `validate` subcommands.
- **`@devenv-preflight/mcp`** — Model Context Protocol server exposing core functions as MCP tools.
- **`@devenv-preflight/setup`** — Zero-config installer that detects AI agents and writes MCP configs for them.

Dependency flow: `cli` → `core`, `mcp` → `core`, `setup` is standalone.

### Core internals

- `types/types.ts` — All type contracts. Canonical source for JSON output shapes.
- `executor/safe-executor.ts` — `safeExec()` and `whichBinary()` with 5s timeout. `whichBinary` uses `which`, so it only works on Unix; the `'win32'` Platform value is not yet supported.
- `detectors/*-detector.ts` — One file per tool (node, python, java, npm, brew, git). Each implements the `ToolDetector` interface.
- `detectors/detector-registry.ts` — `ALL_DETECTORS[]` array. Add new detectors here.
- `scanner.ts` — `scanEnvironment()` produces an `EnvironmentSnapshot`. Maps `ToolCategory` → snapshot field via `CATEGORY_TO_FIELD`. Note: `build-tool` and `system` categories have no corresponding snapshot field yet.
- `validators/validator.ts` — `loadStack()`, `validateStack()`, `recommendFixes()`. `loadStack()` resolves `stacks/` via `__dirname` going 4 levels up from the compiled output (`dist/`), so the `stacks/` directory must exist at the repo root when running from a built package.

### Adding a detector

1. Create `packages/core/src/detectors/<name>-detector.ts` implementing `ToolDetector`.
2. Export it and add it to `ALL_DETECTORS` in `detector-registry.ts`.
3. Ensure the detector's `category` is a key in `CATEGORY_TO_FIELD` in `scanner.ts`, or add a mapping.

### Key design constraints

- All JSON outputs include `meta.schemaVersion` (currently `"0.1.0"`) for forward compatibility.
- Three-tier detection model: `passive` (safe, no auth), `contextual` (reads auth context), `privileged` (hits remote APIs, requires opt-in). Phase 1 is passive-only.
- Stack definitions are declarative JSON files in `stacks/`. The stack `id` must match the filename (e.g., `stacks/node-fullstack.json` → id `"node-fullstack"`).

## New Feature Workflow

Every non-trivial feature follows this gate sequence. Do not write code until each gate is passed:

1. **Plan** — Create `docs/<feature>-plan.md` covering architecture changes, file-level scope, and a day-wise schedule. Present it to Sinister for review.
2. **Finalise** — Incorporate feedback. No implementation until explicit approval ("looks good", "go ahead", etc.).
3. **Task breakdown** — Once approved, list the day's tasks explicitly before starting each day. Confirm the day's scope with Sinister before writing code.
4. **Execute day plan** — Implement one day at a time. Run `npm run build && npm test` at the end of each day. Commit only after green. Do not advance to the next day without checkpoint confirmation.

## Commit Rules

- **Never commit directly.** Always present a diff summary and wait for explicit approval before staging or committing anything.
- **Never push to `master` directly.** Confirm with the user before any `git push`, regardless of branch.
- **Pre-commit gate.** Do not commit if `npm run build` fails or any test is red. Fix the issue first.
- **No secrets or env files.** Never stage `.env`, `.env.*`, `*.pem`, `*.key`, `*secret*`, or any file that contains credentials, tokens, or API keys. If such a file appears in the diff, stop and warn the user.
- **No IDE/tool metadata.** Never stage files or directories starting with `.` that are tool artifacts: `.cursor/`, `.claude/`, `.idea/`, `.vscode/`, `*.DS_Store`, etc. These belong in `.gitignore`.
- **No large or generated files.** Never stage `dist/`, `node_modules/`, build artefacts, or binary blobs.
- **Conventional Commits format.** Every commit message must follow `<type>(<scope>): <subject>` where type is one of `feat | fix | chore | refactor | test | docs | ci | perf`. Subject is imperative, ≤72 chars, no trailing period.
- **Commit footer.** Always append the co-author trailer:
  ```
  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  ```
- **Detailed body when needed.** For non-trivial changes include a blank-line-separated body explaining *why*, not *what*.

## Security Rules

- **Secrets come from env files only.** Read all credentials, tokens, and API keys exclusively from `.env` files or the process environment. If a secret appears in a user prompt or chat message, refuse it, do not use it, and ask the user to provide it via an env file instead.
- **No secret logging.** Never print, echo, or log the value of any environment variable that looks like a secret (contains `KEY`, `TOKEN`, `SECRET`, `PASSWORD`, `DSN`, `CREDENTIAL`).
- **Git operations via MCP first.** Before performing any Git or GitLab operation (push, merge, tag, pipeline trigger), check whether a Git/GitLab MCP server is available. If one is configured, use it. If not, ask the user to supply the required API token via an env file — never hard-code or accept it inline.
- **No `--no-verify` or hook bypasses.** Never skip pre-commit or pre-push hooks unless the user explicitly requests it with a clear reason.
- **Principle of least privilege.** Request only the permissions and scopes actually needed for the task at hand.

## TypeScript config

- Target: ES2022, module: Node16, strict mode enabled.
- Each package has its own `tsconfig.json` extending `tsconfig.base.json`.
- Output goes to `dist/` within each package.

## Code style

- Prettier: single quotes, trailing commas, 100 char print width, 2-space indent.
- ESLint: `@typescript-eslint/recommended`. Unused vars are errors (except `_`-prefixed args). `no-explicit-any` is a warning.
