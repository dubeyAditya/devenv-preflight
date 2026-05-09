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
  };

  const eligible = ALL_DETECTORS.filter((d) => {
    if (!allowedTiers.includes(d.tier)) return false;
    const perm = permissions[d.name];
    if (perm === 'denied') return false;
    if (d.tier !== 'passive' && perm !== 'granted') return false;
    return true;
  });

  const results = await Promise.all(
    eligible.map(async (detector) => {
      const info = await detector.detect(system.os);
      return { name: detector.name, category: detector.category, info };
    }),
  );

  for (const { name, category, info } of results) {
    const field = CATEGORY_TO_FIELD[category];
    if (field) {
      (snapshot[field] as Record<string, ToolInfo>)[name] = info;
    }
  }

  cache.set(cacheKey, snapshot, ttl);

  return snapshot;
}
