import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SnapshotCache, computeCacheKey } from '../src/cache/snapshot-cache.js';
import type { EnvironmentSnapshot } from '../src/types/types.js';

function makeSnapshot(): EnvironmentSnapshot {
  return {
    meta: { schemaVersion: '0.2.0', timestamp: '2026-05-09T00:00:00Z' },
    system: { os: 'darwin', arch: 'arm64', shell: 'zsh' },
    packageManagers: {},
    toolchains: {},
    versionManagers: {},
    vcs: {},
    infra: {},
    contexts: {},
  };
}

describe('SnapshotCache', () => {
  let dir: string;
  let cache: SnapshotCache;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'devenv-cache-'));
    cache = new SnapshotCache(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns null on miss for unknown key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('round-trips snapshot through set/get', () => {
    const snap = makeSnapshot();
    cache.set('k1', snap, 60);
    expect(cache.get('k1')).toEqual(snap);
  });

  it('expires entries past TTL', () => {
    const snap = makeSnapshot();
    cache.set('k1', snap, 1);
    const past = new Date(Date.now() - 5_000).toISOString();
    const file = JSON.parse(readFileSync(join(dir, 'cache.json'), 'utf8'));
    file.k1.cachedAt = past;
    require('node:fs').writeFileSync(join(dir, 'cache.json'), JSON.stringify(file));

    expect(cache.get('k1')).toBeNull();
  });

  it('does not write when ttl is 0', () => {
    cache.set('k1', makeSnapshot(), 0);
    expect(existsSync(join(dir, 'cache.json'))).toBe(false);
  });

  it('does not write when ttl is negative', () => {
    cache.set('k1', makeSnapshot(), -10);
    expect(existsSync(join(dir, 'cache.json'))).toBe(false);
  });

  it('creates the cache directory if missing', () => {
    const nested = join(dir, 'deep', 'path');
    const c = new SnapshotCache(nested);
    c.set('k1', makeSnapshot(), 60);
    expect(existsSync(join(nested, 'cache.json'))).toBe(true);
  });

  it('preserves other entries when invalidating one key', () => {
    cache.set('k1', makeSnapshot(), 60);
    cache.set('k2', makeSnapshot(), 60);
    cache.invalidate('k1');
    expect(cache.get('k1')).toBeNull();
    expect(cache.get('k2')).not.toBeNull();
  });

  it('clears all entries when invalidate is called without a key', () => {
    cache.set('k1', makeSnapshot(), 60);
    cache.set('k2', makeSnapshot(), 60);
    cache.invalidate();
    expect(cache.get('k1')).toBeNull();
    expect(cache.get('k2')).toBeNull();
  });

  it('survives a corrupted cache file by treating it as empty', () => {
    require('node:fs').mkdirSync(dir, { recursive: true });
    require('node:fs').writeFileSync(join(dir, 'cache.json'), '{not json');
    expect(cache.get('k1')).toBeNull();
    cache.set('k1', makeSnapshot(), 60);
    expect(cache.get('k1')).not.toBeNull();
  });
});

describe('computeCacheKey', () => {
  it('returns the same key for equivalent options', () => {
    const a = computeCacheKey({ allowedTiers: ['passive'], permissions: { git: 'granted' } });
    const b = computeCacheKey({ permissions: { git: 'granted' }, allowedTiers: ['passive'] });
    expect(a).toBe(b);
  });

  it('returns different keys for different tier sets', () => {
    const a = computeCacheKey({ allowedTiers: ['passive'] });
    const b = computeCacheKey({ allowedTiers: ['passive', 'contextual'] });
    expect(a).not.toBe(b);
  });

  it('treats undefined options as the default scan (passive only)', () => {
    const a = computeCacheKey(undefined);
    const b = computeCacheKey({ allowedTiers: ['passive'] });
    expect(a).toBe(b);
  });
});
