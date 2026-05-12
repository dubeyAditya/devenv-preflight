#!/usr/bin/env node

import { Command } from 'commander';
import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AGENT_CONFIGS, type AgentMcpConfig } from './agent-configs.js';

const MCP_SERVER_NAME = 'devenv-preflight';

interface McpServerEntry {
  command: string;
  args: string[];
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function buildServerEntry(): McpServerEntry {
  // Resolve the MCP server dist entry point relative to this package
  const mcpEntry = resolve(__dirname, '..', '..', 'mcp', 'dist', 'index.js');
  return { command: 'node', args: [mcpEntry] };
}

async function detectAgents(): Promise<AgentMcpConfig[]> {
  const detected: AgentMcpConfig[] = [];
  for (const agent of AGENT_CONFIGS) {
    if (await pathExists(agent.detectionPath)) {
      detected.push(agent);
    }
  }
  return detected;
}

async function writeClaudeJson(configPath: string, entry: McpServerEntry): Promise<void> {
  const config = await readJson(configPath);
  const mcpServers = (config.mcpServers ?? {}) as Record<string, unknown>;
  mcpServers[MCP_SERVER_NAME] = entry;
  config.mcpServers = mcpServers;
  await writeJson(configPath, config);
}

async function writeMcpJson(configPath: string, entry: McpServerEntry): Promise<void> {
  const config = await readJson(configPath);
  const mcpServers = (config.mcpServers ?? {}) as Record<string, unknown>;
  mcpServers[MCP_SERVER_NAME] = entry;
  config.mcpServers = mcpServers;
  await writeJson(configPath, config);
}

async function installForAgent(agent: AgentMcpConfig, entry: McpServerEntry, dryRun: boolean): Promise<void> {
  process.stdout.write(`  ${agent.name}: ${agent.configPath}\n`);

  if (dryRun) {
    process.stdout.write(`    [dry-run] would write "${MCP_SERVER_NAME}" entry\n`);
    return;
  }

  if (agent.format === 'claude-json') {
    await writeClaudeJson(agent.configPath, entry);
  } else {
    await writeMcpJson(agent.configPath, entry);
  }
  process.stdout.write(`    done\n`);
}

const program = new Command();

program
  .name('devenv-preflight-setup')
  .description('Auto-detect AI agents and register the devenv-preflight MCP server')
  .version('0.1.0')
  .option('--dry-run', 'Show what would be written without making changes')
  .option('--list', 'List detected agents and exit')
  .action(async (opts: { dryRun?: boolean; list?: boolean }) => {
    const detected = await detectAgents();

    if (detected.length === 0) {
      process.stdout.write('No supported AI agents detected.\n');
      process.stdout.write(
        `Supported agents: ${AGENT_CONFIGS.map((a) => a.name).join(', ')}\n`,
      );
      return;
    }

    process.stdout.write(`Detected ${detected.length} agent(s):\n`);
    for (const agent of detected) {
      process.stdout.write(`  - ${agent.name}\n`);
    }

    if (opts.list) return;

    const entry = buildServerEntry();
    process.stdout.write('\nRegistering MCP server...\n');

    for (const agent of detected) {
      await installForAgent(agent, entry, opts.dryRun ?? false);
    }

    if (!opts.dryRun) {
      process.stdout.write('\nSetup complete. Restart your agent to pick up the new MCP server.\n');
    }
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
