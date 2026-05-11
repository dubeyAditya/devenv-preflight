import type {
  ToolDetector,
  ToolInfo,
  ToolContext,
  Platform,
  DetectorCommand,
} from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'docker', args: ['--version'], purpose: 'Detect Docker CLI version', tier: 'passive' },
  {
    command: 'docker',
    args: ['info', '--format', '{{json .}}'],
    purpose: 'Read active Docker context and login status',
    tier: 'contextual',
  },
];

interface DockerInfo {
  Name?: string;
  ServerErrors?: string[];
  RegistryConfig?: { IndexConfigs?: Record<string, unknown> };
  Username?: string;
}

export const dockerDetector: ToolDetector = {
  name: 'docker',
  category: 'infra',
  tier: 'contextual',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const path = await whichBinary('docker');
    if (!path) {
      return { installed: false, version: null, path: null, category: 'infra', tier: 'passive' };
    }

    const result = await safeExec('docker', ['--version']);
    // Output: "Docker version 24.0.7, build afdd53b"
    const match = result.stdout.match(/Docker version\s+([^\s,]+)/);
    const version = result.exitCode === 0 && match ? match[1] : null;

    return { installed: true, version, path, category: 'infra', tier: 'passive' };
  },

  async detectContext(_platform: Platform): Promise<ToolContext | null> {
    const result = await safeExec('docker', ['info', '--format', '{{json .}}']);
    if (result.exitCode !== 0) {
      return {
        tool: 'docker',
        authenticated: false,
        metadata: { reason: 'daemon-unreachable' },
      };
    }

    let info: DockerInfo = {};
    try {
      info = JSON.parse(result.stdout) as DockerInfo;
    } catch {
      return {
        tool: 'docker',
        authenticated: false,
        metadata: { reason: 'unparsable-info' },
      };
    }

    const authenticated = typeof info.Username === 'string' && info.Username.length > 0;
    const metadata: Record<string, string> = {};
    if (info.Name) metadata.activeContext = info.Name;
    if (info.Username) metadata.username = info.Username;

    return { tool: 'docker', authenticated, metadata };
  },
};
