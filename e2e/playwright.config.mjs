import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: process.env.E2E_RESULTS_FILE || '.local/results.json' }]],
  use: {
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
    baseURL: process.env.E2E_FRONTEND_URL || 'http://localhost:5173',
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    // Login/API traces contain credentials or Authorization headers. Keep them off.
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
});
