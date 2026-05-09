import { scanEnvironment } from '../src/scanner';
import { gitDetector, npmDetector } from '../src/index';

describe('scanEnvironment — contextual tier', () => {
  it('does not populate contexts when only passive tier is requested', async () => {
    const snap = await scanEnvironment({ noCache: true });
    expect(snap.contexts).toEqual({});
  }, 15_000);

  it('does not populate contexts when permission is not granted', async () => {
    const snap = await scanEnvironment({
      noCache: true,
      allowedTiers: ['passive', 'contextual'],
    });
    expect(snap.contexts).toEqual({});
  }, 15_000);

  it('populates a context when tier and permission are both granted', async () => {
    const snap = await scanEnvironment({
      noCache: true,
      allowedTiers: ['passive', 'contextual'],
      permissions: { git: 'granted' },
    });
    if (snap.vcs.git?.installed) {
      expect(snap.contexts.git).toBeDefined();
      expect(snap.contexts.git.tool).toBe('git');
      expect(typeof snap.contexts.git.authenticated).toBe('boolean');
    }
  }, 15_000);

  it('does not populate context for a tool that is not installed', async () => {
    const snap = await scanEnvironment({
      noCache: true,
      allowedTiers: ['passive', 'contextual'],
      permissions: { 'nonexistent-tool': 'granted' },
    });
    expect(snap.contexts['nonexistent-tool']).toBeUndefined();
  }, 15_000);

  it('passive detect still runs for contextual-tier detectors when only passive is allowed', async () => {
    const snap = await scanEnvironment({ noCache: true });
    expect(snap.vcs.git).toBeDefined();
    expect(snap.packageManagers.npm).toBeDefined();
  }, 15_000);

  it('skips a tool entirely when permission is denied', async () => {
    const snap = await scanEnvironment({
      noCache: true,
      permissions: { git: 'denied' },
    });
    expect(snap.vcs.git).toBeUndefined();
    expect(snap.contexts.git).toBeUndefined();
  });
});

describe('gitDetector.detectContext', () => {
  it('exposes contextual command in commands list', () => {
    const ctxCommand = gitDetector.commands.find((c) => c.tier === 'contextual');
    expect(ctxCommand).toBeDefined();
    expect(ctxCommand!.command).toBe('git');
  }, 15_000);

  it('declares contextual tier on the detector', () => {
    expect(gitDetector.tier).toBe('contextual');
  }, 15_000);

  it('returns a ToolContext shape when run in this repo', async () => {
    const ctx = await gitDetector.detectContext!('darwin');
    expect(ctx).not.toBeNull();
    expect(ctx!.tool).toBe('git');
    expect(typeof ctx!.authenticated).toBe('boolean');
  });
});

describe('npmDetector.detectContext', () => {
  it('exposes contextual command in commands list', () => {
    const ctxCommand = npmDetector.commands.find((c) => c.tier === 'contextual');
    expect(ctxCommand).toBeDefined();
  }, 15_000);

  it('declares contextual tier on the detector', () => {
    expect(npmDetector.tier).toBe('contextual');
  }, 15_000);

  it('returns a ToolContext that never echoes the auth token value', async () => {
    const ctx = await npmDetector.detectContext!('darwin');
    expect(ctx).not.toBeNull();
    expect(ctx!.tool).toBe('npm');
    // Booleanised — never the actual token
    expect(['true', 'false']).toContain(ctx!.metadata?.authTokenPresent);
    // Sanity: no field anywhere should look like an auth token value
    const blob = JSON.stringify(ctx);
    expect(blob).not.toMatch(/_authToken=/);
    expect(blob).not.toMatch(/_password=/);
  });
});
