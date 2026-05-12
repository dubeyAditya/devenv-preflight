import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { satisfies } from 'semver';
import type {
  StackDefinition,
  EnvironmentSnapshot,
  CompatibilityReport,
  IncompatibleTool,
  FixSuggestion,
  FixPlan,
} from '../types/types.js';
import { SCHEMA_VERSION } from '../types/types.js';

const STACKS_DIR = resolve(__dirname, '..', '..', '..', '..', 'stacks');

export async function loadStack(stackId: string): Promise<StackDefinition> {
  const filePath = resolve(STACKS_DIR, `${stackId}.json`);
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as StackDefinition;
}

function findToolInSnapshot(snapshot: EnvironmentSnapshot, toolName: string) {
  const groups = [
    snapshot.toolchains,
    snapshot.packageManagers,
    snapshot.versionManagers,
    snapshot.vcs,
    snapshot.infra,
  ];
  for (const group of groups) {
    if (toolName in group) return group[toolName];
  }
  return null;
}

export function validateStack(
  snapshot: EnvironmentSnapshot,
  stack: StackDefinition,
): CompatibilityReport {
  const missing: string[] = [];
  const incompatible: IncompatibleTool[] = [];
  const satisfied: string[] = [];
  const notes: string[] = [];

  for (const req of stack.requirements) {
    const tool = findToolInSnapshot(snapshot, req.tool);

    if (!tool || !tool.installed) {
      if (req.required) {
        missing.push(req.tool);
      } else {
        notes.push(`Optional tool '${req.tool}' is not installed.`);
      }
      continue;
    }

    if (tool.version && !satisfies(tool.version, req.versionRange)) {
      incompatible.push({
        tool: req.tool,
        required: req.versionRange,
        actual: tool.version,
        message: `${req.tool} ${tool.version} does not satisfy ${req.versionRange}`,
      });
      continue;
    }

    satisfied.push(req.tool);
  }

  // Add context-aware notes
  if (snapshot.packageManagers.brew?.installed) {
    notes.push("Detected 'brew' on system; recommending Homebrew install steps.");
  }

  return {
    meta: { schemaVersion: SCHEMA_VERSION },
    target: { stack: stack.id, name: stack.name, description: stack.description },
    compatible: missing.length === 0 && incompatible.length === 0,
    missing,
    incompatible,
    satisfied,
    notes,
  };
}

export function recommendFixes(report: CompatibilityReport): FixPlan {
  const fixes: FixSuggestion[] = [];

  for (const tool of report.missing) {
    fixes.push({
      tool,
      problem: 'Not installed',
      suggestion: `Install ${tool}`,
    });
  }

  for (const inc of report.incompatible) {
    fixes.push({
      tool: inc.tool,
      problem: `Version ${inc.actual} does not satisfy ${inc.required}`,
      suggestion: `Upgrade ${inc.tool} to match ${inc.required}`,
    });
  }

  return {
    meta: { schemaVersion: SCHEMA_VERSION },
    target: { stack: report.target.stack },
    fixes,
  };
}
