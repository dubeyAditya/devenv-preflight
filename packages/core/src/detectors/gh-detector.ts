import type {
  ToolDetector,
  ToolInfo,
  ToolContext,
  Platform,
  DetectorCommand,
} from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'gh', args: ['--version'], purpose: 'Detect GitHub CLI version', tier: 'passive' },
  {
    command: 'gh',
    args: ['auth', 'status'],
    purpose: 'Check GitHub CLI auth status',
    tier: 'contextual',
  },
];

function parseAuthStatus(combined: string): { account?: string; host?: string; authenticated: boolean } {
  // gh auth status output (writes to stderr by design):
  //   github.com
  //     ✓ Logged in to github.com account sinister (keyring)
  const hostMatch = combined.match(/^([^\s]+\.[^\s]+)$/m);
  const accountMatch = combined.match(/Logged in to \S+ account (\S+)/);
  const authenticated = /Logged in to/.test(combined);

  const out: { account?: string; host?: string; authenticated: boolean } = { authenticated };
  if (hostMatch) out.host = hostMatch[1];
  if (accountMatch) out.account = accountMatch[1];
  return out;
}

export const ghDetector: ToolDetector = {
  name: 'gh',
  category: 'vcs',
  tier: 'contextual',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const path = await whichBinary('gh');
    if (!path) {
      return { installed: false, version: null, path: null, category: 'vcs', tier: 'passive' };
    }

    const result = await safeExec('gh', ['--version']);
    // Output: "gh version 2.45.0 (2024-03-04)\nhttps://..."
    const match = result.stdout.match(/gh version\s+([^\s]+)/);
    const version = result.exitCode === 0 && match ? match[1] : null;

    return { installed: true, version, path, category: 'vcs', tier: 'passive' };
  },

  async detectContext(_platform: Platform): Promise<ToolContext | null> {
    const result = await safeExec('gh', ['auth', 'status']);
    const combined = `${result.stdout}\n${result.stderr}`;
    const { account, host, authenticated } = parseAuthStatus(combined);

    const metadata: Record<string, string> = {};
    if (host) metadata.host = host;
    if (account) metadata.account = account;

    return {
      tool: 'gh',
      activeProfile: account,
      authenticated,
      metadata,
    };
  },
};
