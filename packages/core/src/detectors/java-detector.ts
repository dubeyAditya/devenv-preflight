import type { ToolDetector, ToolInfo, Platform, DetectorCommand } from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'java', args: ['-version'], purpose: 'Detect Java version (outputs to stderr)', tier: 'passive' },
];

const VERSION_RE = /(?:java|openjdk) version "([^"]+)"/;

export const javaDetector: ToolDetector = {
  name: 'java',
  category: 'language',
  tier: 'passive',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const path = await whichBinary('java');
    if (!path) {
      return { installed: false, version: null, path: null, category: 'language', tier: 'passive' };
    }

    const result = await safeExec('java', ['-version']);
    // java -version writes to stderr
    const output = result.stderr || result.stdout;
    const match = output.match(VERSION_RE);
    const version = match ? match[1] : null;

    return { installed: true, version, path, category: 'language', tier: 'passive' };
  },
};
