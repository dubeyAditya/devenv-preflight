/**
 * @devenv-preflight/core
 *
 * Core library for environment detection, stack validation, and fix recommendations.
 * All public types, functions, and constants are re-exported from this barrel.
 */

// Type contracts
export type {
    Platform,
    ToolCategory,
    DetectionTier,
    PermissionStatus,
    Meta,
    ToolInfo,
    SystemInfo,
    EnvironmentSnapshot,
    DetectorCommand,
    ToolDetector,
    ToolContext,
    StackRequirement,
    StackDefinition,
    IncompatibleTool,
    CompatibilityReport,
    FixSuggestion,
    FixPlan,
    ScanOptions,
    ExecResult,
} from './types/types.js';

// Constants
export { SCHEMA_VERSION } from './types/types.js';

// Executor
export { safeExec, whichBinary } from './executor/safe-executor.js';

// Detectors
export { ALL_DETECTORS } from './detectors/detector-registry.js';
export { nodeDetector } from './detectors/node-detector.js';
export { pythonDetector } from './detectors/python-detector.js';
export { javaDetector } from './detectors/java-detector.js';
export { npmDetector } from './detectors/npm-detector.js';
export { brewDetector } from './detectors/brew-detector.js';
export { gitDetector } from './detectors/git-detector.js';

// Scanner
export { scanEnvironment } from './scanner.js';

// Validator
export { loadStack, validateStack, recommendFixes } from './validators/validator.js';
