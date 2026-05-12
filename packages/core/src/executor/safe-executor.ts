import { execFile } from 'node:child_process';
import type { ExecResult } from '../types/types.js';

const TIMEOUT_MS = 5_000;

export function safeExec(command: string, args: string[]): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout: TIMEOUT_MS }, (error, stdout, stderr) => {
      if (error) {
        const exitCode = 'code' in error && typeof error.code === 'number' ? error.code : 1;
        const timedOut = error.killed || (error as NodeJS.ErrnoException).code === 'ETIMEDOUT';
        resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: timedOut ? -1 : exitCode });
        return;
      }
      resolve({ stdout, stderr, exitCode: 0 });
    });
  });
}

export async function whichBinary(name: string): Promise<string | null> {
  const result = await safeExec('which', [name]);
  if (result.exitCode !== 0) return null;
  return result.stdout.trim() || null;
}
