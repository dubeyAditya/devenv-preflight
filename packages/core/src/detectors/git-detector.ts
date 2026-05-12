import type { ToolDetector, ToolInfo, Platform, DetectorCommand } from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'git', args: ['--version'], purpose: 'Detect Git version', tier: 'passive' },
];

export const gitDetector: ToolDetector = {
  name: 'git',
  category: 'vcs',
  tier: 'passive',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const path = await whichBinary('git');
    if (!path) {
      return { installed: false, version: null, path: null, category: 'vcs', tier: 'passive' };
    }

    const result = await safeExec('git', ['--version']);
    // Output: "git version 2.45.1"
    const version = result.exitCode === 0
      ? result.stdout.trim().replace(/^git version\s+/, '')
      : null;

    return { installed: true, version, path, category: 'vcs', tier: 'passive' };
  },
};
