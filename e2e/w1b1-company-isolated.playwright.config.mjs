import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './diagnostics', testMatch: 'w1b1-company-isolated.spec.mjs',
  timeout: 120_000, expect: { timeout: 12_000 }, workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: '.local/w1b1-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:5178', browserName: 'chromium', viewport: { width: 1440, height: 1000 },
    trace: 'off', video: 'off', screenshot: 'only-on-failure' },
});
