import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './diagnostics', testMatch: 'uiux-acceptance.spec.mjs', workers: 1, retries: 0,
  timeout: 90_000, expect: { timeout: 12_000 }, outputDir: '.local/uiux-acceptance-artifacts',
  reporter: [['list'], ['json', { outputFile: process.env.E2E_RESULTS_FILE || '.local/uiux-acceptance-results.json' }]],
  use: { baseURL: process.env.UIUX_BASE_URL || 'http://127.0.0.1:5177', browserName: 'chromium',
    viewport: { width: 1440, height: 1000 }, trace: 'off', video: 'off', screenshot: 'only-on-failure', actionTimeout: 15_000, navigationTimeout: 20_000 },
});
