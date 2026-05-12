import type { ToolDetector, ToolInfo, Platform, DetectorCommand } from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'brew', args: ['--version'], purpose: 'Detect Homebrew version', tier: 'passive' },
];

export const brewDetector: ToolDetector = {
  name: 'brew',
  category: 'package-manager',
  tier: 'passive',
  commands,

  async detect(platform: Platform): Promise<ToolInfo> {
    const notInstalled: ToolInfo = {
      installed: false, version: null, path: null, category: 'package-manager', tier: 'passive',
    };

    if (platform === 'win32') return notInstalled;

    const path = await whichBinary('brew');
    if (!path) return notInstalled;

    const result = await safeExec('brew', ['--version']);
    // Output: "Homebrew 4.1.0\nHomebrew/homebrew-core ..."
    const firstLine = (result.exitCode === 0 ? result.stdout : '').split('\n')[0];
    const version = firstLine.replace(/^Homebrew\s+/, '').trim() || null;

    return { installed: true, version, path, category: 'package-manager', tier: 'passive' };
  },
};
