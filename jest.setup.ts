import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DEVENV_PREFLIGHT_CACHE_DIR = mkdtempSync(join(tmpdir(), 'devenv-preflight-test-'));
