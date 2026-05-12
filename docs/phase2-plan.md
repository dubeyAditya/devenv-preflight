# DevEnv Preflight — Phase 2 Plan

> Extends Phase 1 (passive scan + validate pipeline) with contextual/privileged
> auth detection, disk-based result caching, and a published Claude Code skill.

---

## Decisions Locked

| # | Decision |
|---|---|
| 1 | Contextual tier before new passive detectors |
| 2 | Git push-capability detection is `privileged` (contacts remote) |
| 3 | Cache stored at `~/.devenv-preflight/cache.json`, TTL-keyed, default 60 s |
| 4 | Skill source in `packages/skill/` (GitLab); distributed via `github.com/sinister/preflight` |
| 5 | Publish = push `packages/skill/` contents to GitHub repo |

---

## Architecture Changes

### EnvironmentSnapshot (schema `0.2.0`)

```diff
 interface EnvironmentSnapshot {
   meta: Meta;
   system: SystemInfo;
   packageManagers: Record<string, ToolInfo>;
   toolchains: Record<string, ToolInfo>;
   versionManagers: Record<string, ToolInfo>;
   vcs: Record<string, ToolInfo>;
   infra: Record<string, ToolInfo>;
+  contexts: Record<string, ToolContext>;   // populated when contextual/privileged tier runs
 }
```

### ScanOptions additions

```diff
 interface ScanOptions {
   allowedTiers?: DetectionTier[];
   permissions?: Record<string, PermissionStatus>;
+  cacheTTL?: number;     // seconds; 0 = disable; default 60
+  noCache?: boolean;     // skip cache read (still writes on miss)
 }
```

### Cache file shape (`~/.devenv-preflight/cache.json`)

```json
{
  "<sha256-of-ScanOptions>": {
    "snapshot": { },
    "cachedAt": "2026-05-09T14:00:00Z",
    "ttl": 60
  }
}
```

---

## Scope

### Track 1 — Disk Cache

| File | Change |
|---|---|
| `packages/core/src/cache/snapshot-cache.ts` | New — `get()`, `set()`, `invalidate()` |
| `packages/core/src/types/types.ts` | Add `cacheTTL`, `noCache` to `ScanOptions` |
| `packages/core/src/scanner.ts` | Wrap scan with cache read/write |
| `packages/cli/src/index.ts` | Add `--no-cache`, `--ttl <n>` flags |
| `packages/mcp/src/index.ts` | Forward cache options from tool input |
| `packages/core/__tests__/cache.test.ts` | New — hit/miss/TTL/invalidation |

### Track 2 — Contextual Tier

| File | Change |
|---|---|
| `packages/core/src/types/types.ts` | Add `contexts` to snapshot; bump `SCHEMA_VERSION` → `"0.2.0"` |
| `packages/core/src/scanner.ts` | Run `detectContext` when tier + permissions allow; populate `snapshot.contexts` |
| `packages/core/src/detectors/git-detector.ts` | `detectContext` → remote URL, SSH vs HTTPS (`contextual`) |
| `packages/core/src/detectors/npm-detector.ts` | `detectContext` → registry URL, auth token present in `~/.npmrc` (`contextual`) |
| `packages/core/src/detectors/docker-detector.ts` | New — passive version + contextual login status (`docker info`) |
| `packages/core/src/detectors/kubectl-detector.ts` | New — passive version + contextual active context/namespace |
| `packages/core/src/detectors/aws-detector.ts` | New — passive cli version + contextual active profile/region |
| `packages/core/src/detectors/gh-detector.ts` | New — passive version + contextual auth status (`gh auth status`) |
| `packages/core/src/detectors/glab-detector.ts` | New — passive version + contextual auth status (`glab auth status`) |
| `packages/core/src/detectors/detector-registry.ts` | Add 5 new detectors |
| `packages/core/__tests__/contextual.test.ts` | New — context shape + permission gate tests |

### Track 3 — Privileged Tier (git push)

| File | Change |
|---|---|
| `packages/core/src/detectors/git-detector.ts` | Extend `detectContext` with privileged push dry-run; set `tier: 'privileged'` for that command |
| `stacks/agent-push-eval.json` | Update to reference new context fields |
| `packages/core/__tests__/contextual.test.ts` | Add privileged gate tests |

### Track 4 — Skill Package

| File | Purpose |
|---|---|
| `packages/skill/package.json` | Package metadata for the skill |
| `packages/skill/skill.md` | Skill definition — scan → match stack → validate → fix guided flow |
| `packages/skill/README.md` | Install + usage instructions |
| `scripts/publish-skill.sh` | Push `packages/skill/` to `github.com/sinister/preflight` |
| `.gitlab-ci.yml` (new or update) | CI job: run publish script on tag |

---

## Day-Wise Schedule

### Day 1 — Cache Infrastructure

**Goal:** Transparent disk caching wired into scan, CLI, and MCP.

| # | File | Work |
|---|---|---|
| 1 | `packages/core/src/cache/snapshot-cache.ts` | `SnapshotCache` class: `get(key)`, `set(key, snapshot, ttl)`, `invalidate(key)`. Reads/writes `~/.devenv-preflight/cache.json` atomically. |
| 2 | `packages/core/src/types/types.ts` | Add `cacheTTL?: number`, `noCache?: boolean` to `ScanOptions` |
| 3 | `packages/core/src/scanner.ts` | Compute cache key from `ScanOptions`, check cache before scan, write after |
| 4 | `packages/cli/src/index.ts` | `--no-cache` flag, `--ttl <seconds>` flag |
| 5 | `packages/mcp/src/index.ts` | Accept `cacheTTL` and `noCache` in tool input schema |
| 6 | `packages/core/__tests__/cache.test.ts` | Cache hit, miss, TTL expiry, `noCache` bypass, concurrent write safety |

**Checkpoint:** `npm run build && npm test` green; `scan` with `--no-cache` vs without shows timing difference

---

### Day 2 — Contextual Scanner + git/npm Contexts

**Goal:** Scanner runs `detectContext` when permitted; git and npm expose auth context.

| # | File | Work |
|---|---|---|
| 1 | `packages/core/src/types/types.ts` | Add `contexts` field to `EnvironmentSnapshot`; bump `SCHEMA_VERSION` to `"0.2.0"` |
| 2 | `packages/core/src/scanner.ts` | Post-passive pass: collect contextual-tier detectors with `permissions[name] === 'granted'`, run `detectContext` in parallel, populate `snapshot.contexts` |
| 3 | `packages/core/src/detectors/git-detector.ts` | `detectContext`: `git remote get-url origin` (remote URL), infer SSH vs HTTPS, check `~/.ssh` key presence |
| 4 | `packages/core/src/detectors/npm-detector.ts` | `detectContext`: `npm config get registry`, parse `~/.npmrc` for `_authToken` presence (boolean only, never value) |
| 5 | `packages/core/__tests__/contextual.test.ts` | Shape tests for `ToolContext`; assert `contexts` absent when tier not granted; assert no secret values leak |

**Checkpoint:** `npm run build && npm test` green; `scan` with `allowedTiers: ['passive','contextual']` + `permissions.git = 'granted'` shows git context in output

---

### Day 3 — New Detectors (docker, kubectl, aws)

**Goal:** Three infra detectors fill the empty `infra` field and contribute contexts.

| # | File | Work |
|---|---|---|
| 1 | `packages/core/src/detectors/docker-detector.ts` | passive: `docker --version`; contextual: `docker info --format json` → login status, active context |
| 2 | `packages/core/src/detectors/kubectl-detector.ts` | passive: `kubectl version --client`; contextual: `kubectl config current-context`, `kubectl config view --minify` → cluster, namespace, auth type |
| 3 | `packages/core/src/detectors/aws-detector.ts` | passive: `aws --version`; contextual: `aws configure list` → active profile, region (no network call) |
| 4 | `packages/core/src/detectors/gh-detector.ts` | passive: `gh --version`, path; contextual: `gh auth status` → authenticated boolean, active account, active host |
| 5 | `packages/core/src/detectors/glab-detector.ts` | passive: `glab --version`, path; contextual: `glab auth status` → authenticated boolean, active user, active host |
| 6 | `packages/core/src/detectors/detector-registry.ts` | Add docker, kubectl, aws, gh, glab to `ALL_DETECTORS` |
| 7 | `packages/core/__tests__/contextual.test.ts` | Extend with shape tests for all 5 new detectors; assert missing tools (`gh`, `glab` not installed) produce clean `installed: false` result |

**Checkpoint:** `npm run build && npm test` green; `scan` output has `infra.docker`, `infra.kubectl`, `infra.aws`, `vcs.gh`, `vcs.glab` (installed: false if absent — exactly the preflight catch)

---

### Day 4 — Privileged Tier (git push) + Stack Update

**Goal:** Push-capability detection behind explicit `privileged` permission gate.

| # | File | Work |
|---|---|---|
| 1 | `packages/core/src/detectors/git-detector.ts` | Extend `detectContext`: if `permissions.git === 'granted'` AND tier includes `privileged`, run `git push --dry-run` on `origin HEAD`; populate `authenticated: boolean`, `metadata.pushAccess` |
| 2 | `packages/core/src/scanner.ts` | Add `privileged` tier pass after contextual — same permission gate pattern |
| 3 | `stacks/agent-push-eval.json` | Update to reference `contexts.git.authenticated` and `contexts.git.metadata.pushAccess` |
| 4 | `packages/core/__tests__/contextual.test.ts` | Privileged gate: assert dry-run never runs unless both `'privileged'` in `allowedTiers` AND `permissions.git === 'granted'` |

**Checkpoint:** `npm run build && npm test` green; privileged scan with denied permission shows no push attempt in logs

---

### Day 5 — Skill Package + Publish Pipeline

**Goal:** `npx skills add sinister/preflight` installs a working Claude Code skill.

| # | File | Work |
|---|---|---|
| 1 | `packages/skill/package.json` | Name `@devenv-preflight/skill`, version `0.2.0`, `files: ["skill.md","README.md"]` |
| 2 | `packages/skill/skill.md` | Skill definition with frontmatter (`name`, `description`, `tools`); guided flow: invoke `scan_environment` → interpret gaps → suggest stack → call `validate_stack` → call `recommend_fixes` → present fix plan |
| 3 | `packages/skill/README.md` | Install: `npx skills add sinister/preflight`; usage: `/devenv-preflight` and `/devenv-preflight validate <stack>` |
| 4 | `scripts/publish-skill.sh` | Clone or init `github.com/sinister/preflight`, copy `packages/skill/` contents, commit, push |
| 5 | `.gitlab-ci.yml` | `publish-skill` job triggered on semver tag; runs `publish-skill.sh` with `GITHUB_TOKEN` from CI secret |

**Checkpoint:** `npx skills add sinister/preflight` installs cleanly; `/devenv-preflight` in Claude Code triggers guided scan flow

---

## Summary

| Day | Track | Key Deliverable |
|---|---|---|
| 1 | Cache | Disk cache wired into scan, CLI, MCP |
| 2 | Contextual | Scanner runs contexts; git + npm auth context |
| 3 | Contextual | docker, kubectl, aws detectors |
| 4 | Privileged | git push-capability behind permission gate |
| 5 | Skill | Published Claude Code skill on GitHub |
