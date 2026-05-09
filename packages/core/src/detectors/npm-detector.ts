import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type {
  ToolDetector,
  ToolInfo,
  ToolContext,
  Platform,
  DetectorCommand,
} from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'npm', args: ['--version'], purpose: 'Detect npm version', tier: 'passive' },
  {
    command: 'npm',
    args: ['config', 'get', 'registry'],
    purpose: 'Read configured npm registry',
    tier: 'contextual',
  },
];

const AUTH_LINE = /(_authToken|_password|_auth)\s*=/;

async function hasAuthToken(): Promise<boolean> {
  try {
    const raw = await readFile(join(homedir(), '.npmrc'), 'utf8');
    return raw.split('\n').some((line) => AUTH_LINE.test(line));
  } catch {
    return false;
  }
}

export const npmDetector: ToolDetector = {
  name: 'npm',
  category: 'package-manager',
  tier: 'contextual',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const path = await whichBinary('npm');
    if (!path) {
      return {
        installed: false,
        version: null,
        path: null,
        category: 'package-manager',
        tier: 'passive',
      };
    }

    const result = await safeExec('npm', ['--version']);
    const version = result.exitCode === 0 ? result.stdout.trim() : null;

    return { installed: true, version, path, category: 'package-manager', tier: 'passive' };
  },

  async detectContext(_platform: Platform): Promise<ToolContext | null> {
    const reg = await safeExec('npm', ['config', 'get', 'registry']);
    const registry = reg.exitCode === 0 ? reg.stdout.trim() : null;
    const authPresent = await hasAuthToken();

    return {
      tool: 'npm',
      authenticated: authPresent,
      metadata: {
        registry: registry ?? 'unknown',
        authTokenPresent: String(authPresent),
      },
    };
  },
};
