import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './diagnostics', testMatch: 'automatic-notifications-isolated.spec.mjs',
  timeout: 120_000, expect: { timeout: 12_000 }, workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: '.local/w1c-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:5176', browserName: 'chromium', viewport: { width: 1440, height: 1000 },
    trace: 'off', video: 'off', screenshot: 'only-on-failure' },
});
