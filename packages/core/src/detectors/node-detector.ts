import type { ToolDetector, ToolInfo, Platform, DetectorCommand } from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'node', args: ['--version'], purpose: 'Detect Node.js version', tier: 'passive' },
];

export const nodeDetector: ToolDetector = {
  name: 'node',
  category: 'language',
  tier: 'passive',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const path = await whichBinary('node');
    if (!path) {
      return { installed: false, version: null, path: null, category: 'language', tier: 'passive' };
    }

    const result = await safeExec('node', ['--version']);
    const version = result.exitCode === 0 ? result.stdout.trim().replace(/^v/, '') : null;

    const metadata: Record<string, string> = {};
    if (path.includes('.nvm')) {
      metadata.manager = 'nvm';
    }

    return {
      installed: true,
      version,
      path,
      category: 'language',
      tier: 'passive',
      ...(Object.keys(metadata).length > 0 && { metadata }),
    };
  },
};
