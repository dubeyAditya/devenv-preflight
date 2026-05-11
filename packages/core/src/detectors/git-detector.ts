import type {
  ToolDetector,
  ToolInfo,
  ToolContext,
  Platform,
  DetectorCommand,
} from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'git', args: ['--version'], purpose: 'Detect Git version', tier: 'passive' },
  {
    command: 'git',
    args: ['remote', 'get-url', 'origin'],
    purpose: 'Read configured origin remote URL',
    tier: 'contextual',
  },
  {
    command: 'git',
    args: ['push', '--dry-run'],
    purpose: 'Verify push access to origin (dry run, no actual push)',
    tier: 'privileged',
  },
];

function classifyRemote(url: string): 'ssh' | 'https' | 'git' | 'other' {
  if (url.startsWith('git@') || url.startsWith('ssh://')) return 'ssh';
  if (url.startsWith('https://')) return 'https';
  if (url.startsWith('git://')) return 'git';
  return 'other';
}

export const gitDetector: ToolDetector = {
  name: 'git',
  category: 'vcs',
  tier: 'contextual',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const path = await whichBinary('git');
    if (!path) {
      return {
        installed: false,
        version: null,
        path: null,
        category: 'vcs',
        tier: 'passive',
      };
    }

    const result = await safeExec('git', ['--version']);
    const version = result.exitCode === 0 ? result.stdout.trim().replace(/^git version\s+/, '') : null;

    return { installed: true, version, path, category: 'vcs', tier: 'passive' };
  },

  async detectContext(_platform: Platform): Promise<ToolContext | null> {
    const remote = await safeExec('git', ['remote', 'get-url', 'origin']);
    if (remote.exitCode !== 0) {
      return {
        tool: 'git',
        authenticated: false,
        metadata: { reason: 'no-origin-remote' },
      };
    }

    const url = remote.stdout.trim();
    const protocol = classifyRemote(url);

    return {
      tool: 'git',
      authenticated: protocol === 'ssh' || protocol === 'https',
      metadata: { remoteUrl: url, protocol },
    };
  },

  async detectPrivilegedContext(_platform: Platform): Promise<ToolContext | null> {
    const result = await safeExec('git', ['push', '--dry-run']);
    const combined = result.stderr + result.stdout;

    let pushAccess: 'granted' | 'denied' | 'unknown';
    if (result.exitCode === 0) {
      pushAccess = 'granted';
    } else if (
      result.exitCode === 128 &&
      (combined.includes('denied') ||
        combined.includes('Authentication failed') ||
        combined.includes('Permission'))
    ) {
      pushAccess = 'denied';
    } else {
      pushAccess = 'unknown';
    }

    return {
      tool: 'git',
      authenticated: pushAccess === 'granted',
      metadata: { pushAccess },
    };
  },
};
