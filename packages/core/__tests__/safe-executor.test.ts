import { safeExec, whichBinary } from '../src/executor/safe-executor';

describe('safeExec', () => {
  it('returns stdout and exitCode 0 for a valid command', async () => {
    const result = await safeExec('echo', ['hello']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('returns non-zero exitCode for a nonexistent binary', async () => {
    const result = await safeExec('__nonexistent_binary_xyz__', ['--version']);
    expect(result.exitCode).not.toBe(0);
  });

  it('captures stderr', async () => {
    const result = await safeExec('node', ['-e', 'console.error("err")']);
    expect(result.exitCode).toBe(0);
    expect(result.stderr.trim()).toBe('err');
  });
});

describe('whichBinary', () => {
  it('returns a path for a known binary', async () => {
    const path = await whichBinary('node');
    expect(path).toBeTruthy();
    expect(typeof path).toBe('string');
  });

  it('returns null for a nonexistent binary', async () => {
    const path = await whichBinary('__nonexistent_binary_xyz__');
    expect(path).toBeNull();
  });
});
