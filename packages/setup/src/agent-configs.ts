import { homedir } from 'node:os';
import { join } from 'node:path';

export interface AgentMcpConfig {
  /** Human-readable agent name */
  name: string;
  /** Absolute path to the agent's MCP config file */
  configPath: string;
  /** How to detect if this agent is installed (path that must exist) */
  detectionPath: string;
  /** Merge the MCP server entry into this config file format */
  format: 'claude-json' | 'mcp-json';
}

const home = homedir();

export const AGENT_CONFIGS: AgentMcpConfig[] = [
  {
    name: 'Claude Code',
    configPath: join(home, '.claude.json'),
    detectionPath: join(home, '.claude.json'),
    format: 'claude-json',
  },
  {
    name: 'Cursor',
    configPath: join(home, '.cursor', 'mcp.json'),
    detectionPath: join(home, '.cursor'),
    format: 'mcp-json',
  },
  {
    name: 'Windsurf',
    configPath: join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    detectionPath: join(home, '.codeium', 'windsurf'),
    format: 'mcp-json',
  },
];
