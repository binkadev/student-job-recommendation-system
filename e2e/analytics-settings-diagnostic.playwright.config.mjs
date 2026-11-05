import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './diagnostics', testMatch: 'analytics-settings-resource.spec.mjs', outputDir: process.env.E2E_DIAGNOSTIC_PREFIX === 'reliability' ? '.local/reliability-n07-artifacts' : '.local/analytics-settings-diagnostic-artifacts', timeout: 90_000,
  expect: { timeout: 12_000 }, workers: 1, retries: 0, reporter: [['list'], ['json', { outputFile: process.env.E2E_RESULTS_FILE || '.local/analytics-settings-diagnostic-results.json' }]],
  use: { baseURL: 'http://localhost:5173', browserName: 'chromium', viewport: { width: 1440, height: 950 }, trace: 'off', video: 'off', screenshot: 'only-on-failure' } });
