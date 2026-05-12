/**
 * DevEnv Preflight — Core Type Contracts
 *
 * These types define the canonical JSON output shapes for all scan,
 * validation, and fix operations. All outputs include meta.schemaVersion
 * for forward compatibility.
 *
 * @module types
 * @version 0.1.0
 */

// =============================================================================
// Enums & Unions
// =============================================================================

/** Supported OS platforms */
export type Platform = 'darwin' | 'linux' | 'win32';

/** Categorization of detected tools */
export type ToolCategory =
    | 'language' // Node, Python, Java, Go, Rust
    | 'package-manager' // brew, apt, npm, pip, maven
    | 'version-manager' // nvm, pyenv, sdkman, rbenv
    | 'infra' // docker, docker-compose, terraform, kubectl
    | 'vcs' // git, gh (GitHub CLI)
    | 'system' // OS-level: shell, curl, wget, make
    | 'build-tool'; // webpack, vite, gradle

/**
 * Three-tier detection model:
 * - passive: Safe, no auth needed (node --version, git --version)
 * - contextual: Reads auth context (kubectl config, aws sts get-caller-identity)
 * - privileged: Requires explicit opt-in (commands that hit remote APIs)
 */
export type DetectionTier = 'passive' | 'contextual' | 'privileged';

/** Permission status for gated detectors */
export type PermissionStatus = 'granted' | 'denied' | 'not-requested';

// =============================================================================
// Schema Meta
// =============================================================================

/** Schema version metadata included in all outputs */
export interface Meta {
    schemaVersion: string;
    timestamp?: string;
}

/** Current schema version constant */
export const SCHEMA_VERSION = '0.1.0';

// =============================================================================
// Tool Detection
// =============================================================================

/** Information about a single detected tool */
export interface ToolInfo {
    installed: boolean;
    version: string | null;
    path: string | null;
    category: ToolCategory;
    tier: DetectionTier;
    metadata?: Record<string, string>;
}

/** System-level information */
export interface SystemInfo {
    os: Platform;
    arch: string;
    shell: string;
}

/**
 * Full environment snapshot grouped by tool category.
 *
 * @example
 * ```json
 * {
 *   "meta": { "schemaVersion": "0.1.0", "timestamp": "2026-04-20T13:43:00Z" },
 *   "system": { "os": "darwin", "arch": "arm64", "shell": "zsh" },
 *   "toolchains": {
 *     "node": { "installed": true, "version": "20.9.0", ... }
 *   },
 *   "packageManagers": {
 *     "brew": { "installed": true, "version": "4.1.0", ... }
 *   }
 * }
 * ```
 */
export interface EnvironmentSnapshot {
    meta: Meta;
    system: SystemInfo;
    packageManagers: Record<string, ToolInfo>;
    toolchains: Record<string, ToolInfo>;
    versionManagers: Record<string, ToolInfo>;
    vcs: Record<string, ToolInfo>;
    infra: Record<string, ToolInfo>;
}

// =============================================================================
// Detector Interface
// =============================================================================

/** Command metadata for transparency — shows what a detector will execute */
export interface DetectorCommand {
    command: string;
    args: string[];
    purpose: string;
    tier: DetectionTier;
}

/**
 * Contract that all tool detectors must implement.
 * Phase 1: all detectors set tier = "passive".
 * Phase 2+: contextual detectors implement detectContext().
 */
export interface ToolDetector {
    /** Unique tool key, e.g. "node", "python", "kubectl" */
    readonly name: string;
    /** Tool category for grouping in snapshot */
    readonly category: ToolCategory;
    /** Detection tier — determines permission requirements */
    readonly tier: DetectionTier;
    /** Declared commands for transparency */
    readonly commands: ReadonlyArray<DetectorCommand>;

    /** Run passive detection. Must be read-only and safe. */
    detect(platform: Platform): Promise<ToolInfo>;

    /** Run context detection (Phase 2+). Only if permission granted. */
    detectContext?(platform: Platform): Promise<ToolContext | null>;
}

/** Auth/context info for gated tools (Phase 2+) */
export interface ToolContext {
    tool: string;
    activeProfile?: string;
    activeContext?: string;
    region?: string;
    authenticated: boolean;
    metadata?: Record<string, string>;
}

// =============================================================================
// Stack Definitions & Validation
// =============================================================================

/** A single requirement from a stack definition */
export interface StackRequirement {
    /** Must match a detector name (e.g. "node", "java") */
    tool: string;
    /** Semver range, e.g. ">=18.0.0" */
    versionRange: string;
    /** true = hard fail if missing, false = warning only */
    required: boolean;
}

/**
 * Declarative stack definition loaded from stacks/*.json
 *
 * @example
 * ```json
 * {
 *   "id": "node-fullstack",
 *   "name": "Node.js Full-Stack",
 *   "description": "Next.js / Express with npm and Git",
 *   "requirements": [
 *     { "tool": "node", "versionRange": ">=18.0.0", "required": true }
 *   ]
 * }
 * ```
 */
export interface StackDefinition {
    id: string;
    name: string;
    description: string;
    requirements: StackRequirement[];
}

/** A tool that was detected but doesn't satisfy the version requirement */
export interface IncompatibleTool {
    tool: string;
    required: string;
    actual: string;
    message: string;
}

/**
 * Compatibility report — result of validating against a stack.
 *
 * @example
 * ```json
 * {
 *   "meta": { "schemaVersion": "0.1.0" },
 *   "target": { "stack": "spring-boot-3", "name": "Spring Boot 3" },
 *   "compatible": false,
 *   "missing": ["java", "maven"],
 *   "incompatible": [],
 *   "satisfied": ["git"],
 *   "notes": ["Detected 'brew' on system; recommending Homebrew install steps."]
 * }
 * ```
 */
export interface CompatibilityReport {
    meta: Meta;
    target: {
        stack: string;
        name: string;
        description: string;
    };
    compatible: boolean;
    missing: string[];
    incompatible: IncompatibleTool[];
    satisfied: string[];
    notes: string[];
}

// =============================================================================
// Fix Plan
// =============================================================================

/** A single remediation suggestion (read-only, no auto-install) */
export interface FixSuggestion {
    tool: string;
    problem: string;
    suggestion: string;
    installHint?: string;
}

/**
 * Collection of fix suggestions derived from a compatibility report.
 * Phase 1: suggestions only, no auto-installation.
 */
export interface FixPlan {
    meta: Meta;
    target: { stack: string };
    fixes: FixSuggestion[];
}

// =============================================================================
// Scan Options
// =============================================================================

/**
 * Options for controlling scan behavior and permissions.
 * Default: only passive tier detectors are executed.
 */
export interface ScanOptions {
    /** Which tiers to execute. Default: ["passive"] */
    allowedTiers?: DetectionTier[];
    /** Explicit per-tool permission overrides */
    permissions?: Record<string, PermissionStatus>;
}

// =============================================================================
// Executor
// =============================================================================

/** Result of a safe command execution */
export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
