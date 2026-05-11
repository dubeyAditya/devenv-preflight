import type {
  ToolDetector,
  ToolInfo,
  ToolContext,
  Platform,
  DetectorCommand,
} from '../types/types.js';
import { safeExec, whichBinary } from '../executor/safe-executor.js';

const commands: readonly DetectorCommand[] = [
  { command: 'aws', args: ['--version'], purpose: 'Detect AWS CLI version', tier: 'passive' },
  {
    command: 'aws',
    args: ['configure', 'list'],
    purpose: 'Read active profile and region (no network call)',
    tier: 'contextual',
  },
];

function parseConfigureList(output: string): { profile?: string; region?: string } {
  const out: { profile?: string; region?: string } = {};
  for (const line of output.split('\n')) {
    const m = line.match(/^\s*(profile|region)\s+(\S+)\s+/);
    if (!m) continue;
    const value = m[2];
    if (value === '<not' || value === '<not set>') continue;
    if (m[1] === 'profile') out.profile = value;
    if (m[1] === 'region') out.region = value;
  }
  return out;
}

export const awsDetector: ToolDetector = {
  name: 'aws',
  category: 'infra',
  tier: 'contextual',
  commands,

  async detect(_platform: Platform): Promise<ToolInfo> {
    const path = await whichBinary('aws');
    if (!path) {
      return { installed: false, version: null, path: null, category: 'infra', tier: 'passive' };
    }

    const result = await safeExec('aws', ['--version']);
    // Output e.g.: "aws-cli/2.15.30 Python/3.11.8 Darwin/23.4.0 source/arm64"
    const match = result.stdout.match(/aws-cli\/([^\s]+)/);
    const version = result.exitCode === 0 && match ? match[1] : null;

    return { installed: true, version, path, category: 'infra', tier: 'passive' };
  },

  async detectContext(_platform: Platform): Promise<ToolContext | null> {
    const result = await safeExec('aws', ['configure', 'list']);
    if (result.exitCode !== 0) {
      return {
        tool: 'aws',
        authenticated: false,
        metadata: { reason: 'configure-list-failed' },
      };
    }

    const { profile, region } = parseConfigureList(result.stdout);
    const metadata: Record<string, string> = {};
    if (profile) metadata.profile = profile;
    if (region) metadata.region = region;

    return {
      tool: 'aws',
      activeProfile: profile,
      region,
      authenticated: Boolean(profile),
      metadata,
    };
  },
};
