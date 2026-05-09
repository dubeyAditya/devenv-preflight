import { ALL_DETECTORS } from '../src/detectors/detector-registry';
import type { ToolInfo, Platform } from '../src/types/types';

const platform: Platform = process.platform as Platform;

describe('detector registry', () => {
  it('exports 6 detectors', () => {
    expect(ALL_DETECTORS).toHaveLength(6);
  });

  it('each detector has unique name', () => {
    const names = ALL_DETECTORS.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe.each(ALL_DETECTORS.map((d) => [d.name, d]))('%s detector', (_name, detector) => {
  it('has required readonly properties', () => {
    expect(typeof detector.name).toBe('string');
    expect(detector.name.length).toBeGreaterThan(0);
    expect(typeof detector.category).toBe('string');
    expect(typeof detector.tier).toBe('string');
    expect(Array.isArray(detector.commands)).toBe(true);
    expect(detector.commands.length).toBeGreaterThan(0);
  });

  it('commands have required fields', () => {
    for (const cmd of detector.commands) {
      expect(typeof cmd.command).toBe('string');
      expect(Array.isArray(cmd.args)).toBe(true);
      expect(typeof cmd.purpose).toBe('string');
      expect(typeof cmd.tier).toBe('string');
    }
  });

  it('detect() returns a valid ToolInfo shape', async () => {
    const info: ToolInfo = await detector.detect(platform);

    expect(typeof info.installed).toBe('boolean');
    expect(info.category).toBe(detector.category);
    // detect() always runs at passive tier regardless of detector classification
    expect(info.tier).toBe('passive');

    if (info.installed) {
      expect(typeof info.version).toBe('string');
      expect(typeof info.path).toBe('string');
    } else {
      expect(info.version).toBeNull();
      expect(info.path).toBeNull();
    }
  }, 10_000);
});
