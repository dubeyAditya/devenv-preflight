import type { ToolDetector, ToolInfo, Platform, DetectorCommand } from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'npm', args: ['--version'], purpose: 'Detect npm version', tier: 'passive' },
];

export const npmDetector: ToolDetector = {
  name: 'npm',
  category: 'package-manager',
  tier: 'passive',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const path = await whichBinary('npm');
    if (!path) {
      return { installed: false, version: null, path: null, category: 'package-manager', tier: 'passive' };
    }

    const result = await safeExec('npm', ['--version']);
    const version = result.exitCode === 0 ? result.stdout.trim() : null;

    return { installed: true, version, path, category: 'package-manager', tier: 'passive' };
  },
};
