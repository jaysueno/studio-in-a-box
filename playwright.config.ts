import { defineConfig, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';

// The local stack's public values, read at run time so a fresh clone needs no .env.local.
function localEnv(): Record<string, string> {
  try {
    const out = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8' });
    const match = out.match(/^ANON_KEY="?(.*?)"?$/m);
    return {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: match ? match[1] : '',
    };
  } catch {
    return { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '' };
  }
}

const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `PORT=${PORT} pnpm dev`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: localEnv(),
  },
});
