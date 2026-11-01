import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const python = process.platform === 'win32' && existsSync('.venv/Scripts/python.exe')
  ? resolve('.venv/Scripts/python.exe') : 'python';
const baseURL = 'http://127.0.0.1:5017';

export default defineConfig({
  testDir: './tests/smoke',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list'], ['json', { outputFile: 'tests/artifacts/smoke/results.json' }]],
  outputDir: 'tests/artifacts/smoke/runs',
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `"${python}" -m tests.smoke.server`,
    url: `${baseURL}/healthz`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
