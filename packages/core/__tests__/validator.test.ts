import { loadStack, validateStack, recommendFixes } from '../src/validators/validator';
import { scanEnvironment } from '../src/scanner';
import type { EnvironmentSnapshot, StackDefinition } from '../src/types/types';

describe('loadStack', () => {
  it('loads node-fullstack stack definition', async () => {
    const stack = await loadStack('node-fullstack');
    expect(stack.id).toBe('node-fullstack');
    expect(stack.requirements.length).toBeGreaterThan(0);
  });

  it('loads spring-boot stack definition', async () => {
    const stack = await loadStack('spring-boot');
    expect(stack.id).toBe('spring-boot');
  });

  it('throws for nonexistent stack', async () => {
    await expect(loadStack('nonexistent-stack')).rejects.toThrow();
  });
});

describe('validateStack', () => {
  let snapshot: EnvironmentSnapshot;

  beforeAll(async () => {
    snapshot = await scanEnvironment();
  }, 15_000);

  it('returns a valid CompatibilityReport shape', async () => {
    const stack = await loadStack('node-fullstack');
    const report = validateStack(snapshot, stack);

    expect(report.meta.schemaVersion).toBe('0.1.0');
    expect(report.target.stack).toBe('node-fullstack');
    expect(typeof report.compatible).toBe('boolean');
    expect(Array.isArray(report.missing)).toBe(true);
    expect(Array.isArray(report.incompatible)).toBe(true);
    expect(Array.isArray(report.satisfied)).toBe(true);
    expect(Array.isArray(report.notes)).toBe(true);
  });

  it('reports missing tools correctly', () => {
    const fakeStack: StackDefinition = {
      id: 'test',
      name: 'Test',
      description: 'test',
      requirements: [
        { tool: 'nonexistent-tool', versionRange: '>=1.0.0', required: true },
      ],
    };
    const report = validateStack(snapshot, fakeStack);
    expect(report.compatible).toBe(false);
    expect(report.missing).toContain('nonexistent-tool');
  });

  it('reports incompatible versions', () => {
    const fakeStack: StackDefinition = {
      id: 'test',
      name: 'Test',
      description: 'test',
      requirements: [
        { tool: 'node', versionRange: '>=999.0.0', required: true },
      ],
    };
    const report = validateStack(snapshot, fakeStack);
    expect(report.compatible).toBe(false);
    expect(report.incompatible).toHaveLength(1);
    expect(report.incompatible[0].tool).toBe('node');
  });

  it('marks optional missing tools as notes, not missing', () => {
    const fakeStack: StackDefinition = {
      id: 'test',
      name: 'Test',
      description: 'test',
      requirements: [
        { tool: 'nonexistent-tool', versionRange: '>=1.0.0', required: false },
      ],
    };
    const report = validateStack(snapshot, fakeStack);
    expect(report.missing).not.toContain('nonexistent-tool');
    expect(report.notes.some((n) => n.includes('nonexistent-tool'))).toBe(true);
  });
});

describe('recommendFixes', () => {
  it('generates fixes for missing and incompatible tools', () => {
    const report = {
      meta: { schemaVersion: '0.1.0' },
      target: { stack: 'test', name: 'Test', description: 'test' },
      compatible: false,
      missing: ['java'],
      incompatible: [
        { tool: 'node', required: '>=20.0.0', actual: '18.0.0', message: '' },
      ],
      satisfied: ['git'],
      notes: [],
    };

    const plan = recommendFixes(report);
    expect(plan.meta.schemaVersion).toBe('0.1.0');
    expect(plan.fixes).toHaveLength(2);
    expect(plan.fixes[0].tool).toBe('java');
    expect(plan.fixes[1].tool).toBe('node');
  });

  it('returns empty fixes for a compatible report', () => {
    const report = {
      meta: { schemaVersion: '0.1.0' },
      target: { stack: 'test', name: 'Test', description: 'test' },
      compatible: true,
      missing: [],
      incompatible: [],
      satisfied: ['node', 'git'],
      notes: [],
    };

    const plan = recommendFixes(report);
    expect(plan.fixes).toHaveLength(0);
  });
});
