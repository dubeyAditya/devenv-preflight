#!/usr/bin/env node

import { Command } from 'commander';
import { scanEnvironment, loadStack, validateStack, recommendFixes } from '@devenv-preflight/core';

const program = new Command();

program
  .name('devenv-preflight')
  .description('Environment intelligence layer for AI coding agents')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan the local environment and output a JSON snapshot')
  .option('--pretty', 'Pretty-print JSON output')
  .action(async (opts: { pretty?: boolean }) => {
    const snapshot = await scanEnvironment();
    const output = opts.pretty
      ? JSON.stringify(snapshot, null, 2)
      : JSON.stringify(snapshot);
    process.stdout.write(output + '\n');
  });

program
  .command('validate')
  .description('Validate the environment against a stack definition')
  .requiredOption('--stack <id>', 'Stack ID to validate against (e.g. node-fullstack)')
  .option('--pretty', 'Pretty-print JSON output')
  .option('--fixes', 'Include fix recommendations in output')
  .action(async (opts: { stack: string; pretty?: boolean; fixes?: boolean }) => {
    const [snapshot, stack] = await Promise.all([scanEnvironment(), loadStack(opts.stack)]);
    const report = validateStack(snapshot, stack);

    if (opts.fixes) {
      const plan = recommendFixes(report);
      const out = { report, fixes: plan };
      process.stdout.write((opts.pretty ? JSON.stringify(out, null, 2) : JSON.stringify(out)) + '\n');
    } else {
      process.stdout.write((opts.pretty ? JSON.stringify(report, null, 2) : JSON.stringify(report)) + '\n');
    }

    if (!report.compatible) {
      process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
