import { scanEnvironment } from '../src/scanner';
import type { EnvironmentSnapshot } from '../src/types/types';

describe('scanEnvironment', () => {
  let snapshot: EnvironmentSnapshot;

  beforeAll(async () => {
    snapshot = await scanEnvironment();
  }, 15_000);

  it('includes meta with schemaVersion and timestamp', () => {
    expect(snapshot.meta.schemaVersion).toBe('0.2.0');
    expect(typeof snapshot.meta.timestamp).toBe('string');
  });

  it('includes system info', () => {
    expect(['darwin', 'linux', 'win32']).toContain(snapshot.system.os);
    expect(typeof snapshot.system.arch).toBe('string');
    expect(typeof snapshot.system.shell).toBe('string');
  });

  it('groups tools into correct snapshot fields', () => {
    expect(typeof snapshot.toolchains).toBe('object');
    expect(typeof snapshot.packageManagers).toBe('object');
    expect(typeof snapshot.versionManagers).toBe('object');
    expect(typeof snapshot.vcs).toBe('object');
    expect(typeof snapshot.infra).toBe('object');
  });

  it('places node under toolchains', () => {
    expect(snapshot.toolchains).toHaveProperty('node');
    expect(snapshot.toolchains.node.category).toBe('language');
  });

  it('places npm under packageManagers', () => {
    expect(snapshot.packageManagers).toHaveProperty('npm');
    expect(snapshot.packageManagers.npm.category).toBe('package-manager');
  });

  it('places git under vcs', () => {
    expect(snapshot.vcs).toHaveProperty('git');
    expect(snapshot.vcs.git.category).toBe('vcs');
  });

  it('respects allowedTiers filter', async () => {
    const result = await scanEnvironment({ allowedTiers: ['contextual'] });
    // All Phase 1 detectors are passive, so nothing should run
    expect(Object.keys(result.toolchains)).toHaveLength(0);
    expect(Object.keys(result.packageManagers)).toHaveLength(0);
    expect(Object.keys(result.vcs)).toHaveLength(0);
  });

  it('respects per-tool deny permission', async () => {
    const result = await scanEnvironment({ permissions: { node: 'denied' } });
    expect(result.toolchains).not.toHaveProperty('node');
  });
});
