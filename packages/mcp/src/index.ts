#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { scanEnvironment, loadStack, validateStack, recommendFixes } from '@devenv-preflight/core';

const server = new McpServer({
  name: 'devenv-preflight',
  version: '0.1.0',
});

server.registerTool(
  'scan_environment',
  {
    description:
      'Scan the local developer environment and return a structured JSON snapshot of installed toolchains, package managers, version managers, VCS tools, and infra tools.',
  },
  async () => {
    const snapshot = await scanEnvironment();
    return {
      content: [{ type: 'text', text: JSON.stringify(snapshot, null, 2) }],
    };
  },
);

server.registerTool(
  'validate_stack',
  {
    description:
      'Validate the current environment against a named stack definition (e.g. "node-fullstack", "spring-boot", "agent-push-eval"). Returns a compatibility report with missing and incompatible tools.',
    inputSchema: {
      stackId: z.string().describe('Stack ID matching a file in stacks/ (e.g. "node-fullstack")'),
    },
  },
  async ({ stackId }) => {
    const [snapshot, stack] = await Promise.all([scanEnvironment(), loadStack(stackId)]);
    const report = validateStack(snapshot, stack);
    return {
      content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
    };
  },
);

server.registerTool(
  'recommend_fixes',
  {
    description:
      'Generate a fix plan for a stack that the environment does not satisfy. Returns actionable suggestions for missing or incompatible tools.',
    inputSchema: {
      stackId: z.string().describe('Stack ID to generate fix recommendations for'),
    },
  },
  async ({ stackId }) => {
    const [snapshot, stack] = await Promise.all([scanEnvironment(), loadStack(stackId)]);
    const report = validateStack(snapshot, stack);
    const plan = recommendFixes(report);
    return {
      content: [{ type: 'text', text: JSON.stringify(plan, null, 2) }],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
