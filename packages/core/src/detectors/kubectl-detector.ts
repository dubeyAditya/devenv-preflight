import type {
  ToolDetector,
  ToolInfo,
  ToolContext,
  Platform,
  DetectorCommand,
} from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  {
    command: 'kubectl',
    args: ['version', '--client', '--output=json'],
    purpose: 'Detect kubectl client version',
    tier: 'passive',
  },
  {
    command: 'kubectl',
    args: ['config', 'current-context'],
    purpose: 'Read active kube context',
    tier: 'contextual',
  },
  {
    command: 'kubectl',
    args: ['config', 'view', '--minify', '-o', 'json'],
    purpose: 'Read active cluster, namespace, auth method',
    tier: 'contextual',
  },
];

interface KubectlVersion {
  clientVersion?: { gitVersion?: string };
}

interface KubectlConfig {
  contexts?: Array<{
    name?: string;
    context?: { cluster?: string; namespace?: string; user?: string };
  }>;
  users?: Array<{
    name?: string;
    user?: Record<string, unknown>;
  }>;
}

function classifyAuth(user: Record<string, unknown> | undefined): string {
  if (!user) return 'none';
  if ('token' in user) return 'token';
  if ('client-certificate' in user || 'client-certificate-data' in user) return 'cert';
  if ('exec' in user) return 'exec-plugin';
  if ('auth-provider' in user) return 'auth-provider';
  if ('username' in user) return 'basic';
  return 'unknown';
}

export const kubectlDetector: ToolDetector = {
  name: 'kubectl',
  category: 'infra',
  tier: 'contextual',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const path = await whichBinary('kubectl');
    if (!path) {
      return { installed: false, version: null, path: null, category: 'infra', tier: 'passive' };
    }

    const result = await safeExec('kubectl', ['version', '--client', '--output=json']);
    let version: string | null = null;
    if (result.exitCode === 0) {
      try {
        const parsed = JSON.parse(result.stdout) as KubectlVersion;
        version = parsed.clientVersion?.gitVersion?.replace(/^v/, '') ?? null;
      } catch {
        version = null;
      }
    }

    return { installed: true, version, path, category: 'infra', tier: 'passive' };
  },

  async detectContext(_platform: Platform): Promise<ToolContext | null> {
    const cur = await safeExec('kubectl', ['config', 'current-context']);
    if (cur.exitCode !== 0) {
      return {
        tool: 'kubectl',
        authenticated: false,
        metadata: { reason: 'no-current-context' },
      };
    }
    const activeContext = cur.stdout.trim();

    const view = await safeExec('kubectl', ['config', 'view', '--minify', '-o', 'json']);
    if (view.exitCode !== 0) {
      return { tool: 'kubectl', activeContext, authenticated: false };
    }

    let cfg: KubectlConfig = {};
    try {
      cfg = JSON.parse(view.stdout) as KubectlConfig;
    } catch {
      return { tool: 'kubectl', activeContext, authenticated: false };
    }

    const ctx = cfg.contexts?.[0]?.context;
    const userName = ctx?.user;
    const userEntry = cfg.users?.find((u) => u.name === userName);
    const authMethod = classifyAuth(userEntry?.user);

    return {
      tool: 'kubectl',
      activeContext,
      authenticated: authMethod !== 'none' && authMethod !== 'unknown',
      metadata: {
        cluster: ctx?.cluster ?? '',
        namespace: ctx?.namespace ?? 'default',
        authMethod,
      },
    };
  },
};
