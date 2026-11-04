import base from './playwright.config.mjs';
import { defineConfig } from '@playwright/test';

export default defineConfig({ ...base, testDir: './diagnostics', testMatch: 'b06-reload.spec.mjs', reporter: [['list'], ['json', { outputFile: process.env.E2E_RESULTS_FILE || '.local/b06-results.json' }]] });
