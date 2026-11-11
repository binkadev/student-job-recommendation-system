import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
const fixture = process.env.RECRUITING_WORKFLOWS_FIXTURE;
const baseURL = process.env.RECRUITING_WORKFLOWS_FRONTEND;
const ignored = path.resolve('.local') + path.sep;
if (!fixture || !path.resolve(fixture).startsWith(ignored) || !fs.existsSync(fixture) || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL ?? '')) throw new Error('Use the dedicated isolated runner.');
const local = path.dirname(fixture);
const metadata = JSON.parse(fs.readFileSync(fixture, "utf8"));
export default defineConfig({
  testDir: './diagnostics', testMatch: 'recruiting-workflows-isolated.spec.mjs',
  timeout: 60_000, expect: { timeout: 12_000 }, workers: 1, retries: 0,
  outputDir: path.join(local, 'browser-artifacts'),
  reporter: [['list'], ['json', { outputFile: path.join(local, 'results.json') }]],
  use: { baseURL, timezoneId: metadata.serverZone, browserName: 'chromium', viewport: { width: 1440, height: 1000 },
    trace: 'off', video: 'off', screenshot: 'only-on-failure' },
});
