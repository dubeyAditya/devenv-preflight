/**
 * Disk-backed cache for environment snapshots.
 *
 * Stores results at ~/.devenv-preflight/cache.json (override via constructor
 * for tests). Each entry is keyed by a hash of the ScanOptions that produced
 * it, so semantically different scans don't collide. Reads return null when
 * the entry is missing or its TTL has expired. Writes are atomic via
 * write-to-temp-then-rename.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { EnvironmentSnapshot, ScanOptions } from '../types/types.js';

interface CacheEntry {
  snapshot: EnvironmentSnapshot;
  cachedAt: string;
  ttl: number;
}

interface CacheFile {
  [key: string]: CacheEntry;
}

const CACHE_FILENAME = 'cache.json';

function defaultCacheDir(): string {
  return process.env.DEVENV_PREFLIGHT_CACHE_DIR ?? join(homedir(), '.devenv-preflight');
}

/** Stable JSON stringification — sorts object keys recursively. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Compute a stable cache key from scan options. */
export function computeCacheKey(options: ScanOptions | undefined): string {
  const normalized = {
    allowedTiers: options?.allowedTiers ?? ['passive'],
    permissions: options?.permissions ?? {},
  };
  return createHash('sha256').update(stableStringify(normalized)).digest('hex');
}

export class SnapshotCache {
  private readonly cachePath: string;

  constructor(cacheDir?: string) {
    this.cachePath = join(cacheDir ?? defaultCacheDir(), CACHE_FILENAME);
  }

  /** Returns the cached snapshot if present and unexpired, else null. */
  get(key: string): EnvironmentSnapshot | null {
    const file = this.readFile();
    const entry = file[key];
    if (!entry) return null;

    const ageSeconds = (Date.now() - new Date(entry.cachedAt).getTime()) / 1000;
    if (ageSeconds > entry.ttl) return null;

    return entry.snapshot;
  }

  /** Writes an entry. ttl=0 disables write entirely. */
  set(key: string, snapshot: EnvironmentSnapshot, ttl: number): void {
    if (ttl <= 0) return;

    const file = this.readFile();
    file[key] = {
      snapshot,
      cachedAt: new Date().toISOString(),
      ttl,
    };
    this.writeFile(file);
  }

  /** Removes a single entry, or the entire cache if no key given. */
  invalidate(key?: string): void {
    if (key === undefined) {
      this.writeFile({});
      return;
    }
    const file = this.readFile();
    if (key in file) {
      delete file[key];
      this.writeFile(file);
    }
  }

  private readFile(): CacheFile {
    if (!existsSync(this.cachePath)) return {};
    try {
      const raw = readFileSync(this.cachePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      return parsed as CacheFile;
    } catch {
      return {};
    }
  }

  private writeFile(file: CacheFile): void {
    const dir = dirname(this.cachePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tmp = `${this.cachePath}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(file, null, 2), 'utf8');
    renameSync(tmp, this.cachePath);
  }
}
