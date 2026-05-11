import type {
  ToolDetector,
  ToolInfo,
  ToolContext,
  Platform,
  DetectorCommand,
} from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'glab', args: ['--version'], purpose: 'Detect GitLab CLI version', tier: 'passive' },
  {
    command: 'glab',
    args: ['auth', 'status'],
    purpose: 'Check GitLab CLI auth status',
    tier: 'contextual',
  },
];

function parseAuthStatus(combined: string): { user?: string; host?: string; authenticated: boolean } {
  // glab auth status output (writes to stderr):
  //   gitlab.com
  //     ✓ Logged in to gitlab.com as sinister (keyring)
  const hostMatch = combined.match(/^([^\s]+\.[^\s]+)$/m);
  const userMatch = combined.match(/Logged in to \S+ as (\S+)/);
  const authenticated = /Logged in to/.test(combined);

  const out: { user?: string; host?: string; authenticated: boolean } = { authenticated };
  if (hostMatch) out.host = hostMatch[1];
  if (userMatch) out.user = userMatch[1];
  return out;
}

export const glabDetector: ToolDetector = {
  name: 'glab',
  category: 'vcs',
  tier: 'contextual',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const path = await whichBinary('glab');
    if (!path) {
      return { installed: false, version: null, path: null, category: 'vcs', tier: 'passive' };
    }

    const result = await safeExec('glab', ['--version']);
    // Output: "glab 1.36.0 (2024-02-28)"
    const match = result.stdout.match(/glab\s+([^\s]+)/);
    const version = result.exitCode === 0 && match ? match[1] : null;

    return { installed: true, version, path, category: 'vcs', tier: 'passive' };
  },

  async detectContext(_platform: Platform): Promise<ToolContext | null> {
    const result = await safeExec('glab', ['auth', 'status']);
    const combined = `${result.stdout}\n${result.stderr}`;
    const { user, host, authenticated } = parseAuthStatus(combined);

    const metadata: Record<string, string> = {};
    if (host) metadata.host = host;
    if (user) metadata.user = user;

    return {
      tool: 'glab',
      activeProfile: user,
      authenticated,
      metadata,
    };
  },
};
