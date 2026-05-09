import { scanEnvironment } from '../src/scanner';
import { loadStack, validateStack, recommendFixes } from '../src/validators/validator';
import type { EnvironmentSnapshot, CompatibilityReport, FixPlan } from '../src/types/types';

describe('E2E pipeline: scan → validate → fix', () => {
  let snapshot: EnvironmentSnapshot;

  beforeAll(async () => {
    snapshot = await scanEnvironment();
  }, 15_000);

  it('produces a valid snapshot with meta', () => {
    expect(snapshot.meta.schemaVersion).toBe('0.2.0');
    expect(typeof snapshot.meta.timestamp).toBe('string');
  });

  it('full pipeline against node-fullstack', async () => {
    const stack = await loadStack('node-fullstack');
    const report: CompatibilityReport = validateStack(snapshot, stack);

    expect(report.meta.schemaVersion).toBe('0.2.0');
    expect(report.target.stack).toBe('node-fullstack');
    expect(typeof report.compatible).toBe('boolean');
    expect(Array.isArray(report.missing)).toBe(true);
    expect(Array.isArray(report.incompatible)).toBe(true);
    expect(Array.isArray(report.satisfied)).toBe(true);

    const plan: FixPlan = recommendFixes(report);
    expect(plan.meta.schemaVersion).toBe('0.2.0');
    expect(plan.target.stack).toBe('node-fullstack');
    expect(Array.isArray(plan.fixes)).toBe(true);

    // Fixes should only cover tools that are missing or incompatible
    const problemTools = [...report.missing, ...report.incompatible.map((i) => i.tool)];
    expect(plan.fixes.length).toBe(problemTools.length);
  });

  it('full pipeline against spring-boot', async () => {
    const stack = await loadStack('spring-boot');
    const report = validateStack(snapshot, stack);
    const plan = recommendFixes(report);

    expect(report.target.stack).toBe('spring-boot');
    expect(plan.target.stack).toBe('spring-boot');

    // Fixes must correspond 1:1 to problems
    const problemCount = report.missing.length + report.incompatible.length;
    expect(plan.fixes.length).toBe(problemCount);
  });

  it('compatible flag is false when there are missing required tools', async () => {
    const stack = await loadStack('spring-boot');
    const report = validateStack(snapshot, stack);
    // spring-boot requires java — likely missing on this machine
    if (report.missing.length > 0) {
      expect(report.compatible).toBe(false);
    }
  });

  it('all stacks produce structurally valid reports', async () => {
    const stackIds = ['node-fullstack', 'spring-boot', 'agent-push-eval'];
    for (const id of stackIds) {
      const stack = await loadStack(id);
      const report = validateStack(snapshot, stack);
      expect(report.meta).toBeDefined();
      expect(report.target.stack).toBe(id);
      expect(typeof report.compatible).toBe('boolean');
    }
  });
});
