import type { ToolDetector, ToolInfo, Platform, DetectorCommand } from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'python3', args: ['--version'], purpose: 'Detect Python 3 version', tier: 'passive' },
  { command: 'python', args: ['--version'], purpose: 'Fallback: detect Python version', tier: 'passive' },
];

export const pythonDetector: ToolDetector = {
  name: 'python',
  category: 'language',
  tier: 'passive',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const notInstalled: ToolInfo = {
      installed: false, version: null, path: null, category: 'language', tier: 'passive',
    };

    // Try python3 first, then python
    let binary = await whichBinary('python3');
    let cmd = 'python3';
    if (!binary) {
      binary = await whichBinary('python');
      cmd = 'python';
    }
    if (!binary) return notInstalled;

    const result = await safeExec(cmd, ['--version']);
    const version = result.exitCode === 0
      ? result.stdout.trim().replace(/^Python\s+/, '')
      : null;

    return { installed: true, version, path: binary, category: 'language', tier: 'passive' };
  },
};
