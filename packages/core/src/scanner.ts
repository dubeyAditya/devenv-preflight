import { platform, arch } from 'node:os';
import type {
  EnvironmentSnapshot,
  Platform,
  ScanOptions,
  ToolInfo,
} from './types/types.js';
import { SCHEMA_VERSION } from './types/types.js';
import { ALL_DETECTORS } from './detectors/detector-registry.js';
import { SnapshotCache, computeCacheKey } from './cache/snapshot-cache.js';

const DEFAULT_CACHE_TTL_SECONDS = 60;

const CATEGORY_TO_FIELD: Record<string, keyof EnvironmentSnapshot> = {
  'language': 'toolchains',
  'package-manager': 'packageManagers',
  'version-manager': 'versionManagers',
  'vcs': 'vcs',
  'infra': 'infra',
};

function getSystemInfo(): { os: Platform; arch: string; shell: string } {
  const os = platform() as Platform;
  const shell = process.env.SHELL?.split('/').pop() ?? 'unknown';
  return { os, arch: arch(), shell };
}

export async function scanEnvironment(options?: ScanOptions): Promise<EnvironmentSnapshot> {
  const allowedTiers = options?.allowedTiers ?? ['passive'];
  const permissions = options?.permissions ?? {};
  const ttl = options?.cacheTTL ?? DEFAULT_CACHE_TTL_SECONDS;
  const noCache = options?.noCache ?? false;

  const cache = new SnapshotCache();
  const cacheKey = computeCacheKey(options);

  if (!noCache) {
    const cached = cache.get(cacheKey);
    if (cached) return cached;
  }

  const system = getSystemInfo();

  const snapshot: EnvironmentSnapshot = {
    meta: { schemaVersion: SCHEMA_VERSION, timestamp: new Date().toISOString() },
    system,
    packageManagers: {},
    toolchains: {},
    versionManagers: {},
    vcs: {},
    infra: {},
    contexts: {},
  };

  const passiveAllowed = allowedTiers.includes('passive');

  const passiveResults = passiveAllowed
    ? await Promise.all(
        ALL_DETECTORS.filter((d) => permissions[d.name] !== 'denied').map(async (detector) => {
          const info = await detector.detect(system.os);
          return { detector, info };
        }),
      )
    : [];

  for (const { detector, info } of passiveResults) {
    const field = CATEGORY_TO_FIELD[detector.category];
    if (field) {
      (snapshot[field] as Record<string, ToolInfo>)[detector.name] = info;
    }
  }

  const contextEligible = passiveResults.filter(
    ({ detector, info }) =>
      detector.detectContext &&
      info.installed &&
      allowedTiers.includes(detector.tier) &&
      permissions[detector.name] === 'granted',
  );

  const contextResults = await Promise.all(
    contextEligible.map(async ({ detector }) => {
      const ctx = await detector.detectContext!(system.os);
      return { name: detector.name, ctx };
    }),
  );

  for (const { name, ctx } of contextResults) {
    if (ctx) snapshot.contexts[name] = ctx;
  }

  const privilegedEligible = passiveResults.filter(
    ({ detector, info }) =>
      detector.detectPrivilegedContext &&
      info.installed &&
      allowedTiers.includes('privileged') &&
      permissions[detector.name] === 'granted',
  );

  const privilegedResults = await Promise.all(
    privilegedEligible.map(async ({ detector }) => {
      const ctx = await detector.detectPrivilegedContext!(system.os);
      return { name: detector.name, ctx };
    }),
  );

  for (const { name, ctx } of privilegedResults) {
    if (!ctx) continue;
    const existing = snapshot.contexts[name];
    if (existing) {
      snapshot.contexts[name] = {
        ...existing,
        ...ctx,
        metadata: { ...existing.metadata, ...ctx.metadata },
      };
    } else {
      snapshot.contexts[name] = ctx;
    }
  }

  cache.set(cacheKey, snapshot, ttl);

  return snapshot;
}
