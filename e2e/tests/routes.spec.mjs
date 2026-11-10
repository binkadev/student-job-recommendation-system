import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { root, local, readLocal, writeLocal, credentials, login, ok } from '../helpers.mjs';

const source = fs.readFileSync(path.join(root, '../frontend/src/constants/routes.ts'), 'utf8');
const groups = [...source.matchAll(/export const (\w+)Routes: AppRoute\[\] = \[([\s\S]*?)\n\];/g)].map(([, group, body]) => ({ group, paths: [...body.matchAll(/\{ path: "([^"]+)"/g)].map(m => m[1]) }));
const manifest = readLocal('manifest.json');

test('R01 all 80 Public/Auth/Student/Company declared routes — navigation/control inventory only', async ({ browser }) => {
  test.setTimeout(240_000);
  fs.mkdirSync(path.join(local, 'routes'), { recursive: true });
  const application = (await ok('GET', `/students/me/applications?jobId=${manifest.jobs[0].id}`, await login('student')))[0];
  expect(application?.id).toBeDefined();
  const substitutions = { jobId: manifest.jobs[0].id, companyId: manifest.accounts.company.companyId, cvId: manifest.cvs.student[0].id, applicationId: application.id, candidateId: application.id, campaignId: 1, interviewId: 1, invitationId: 1, conversationId: 1, slug: 'cv-tips' };
  const rows = [];
  let requests = [];
  let pageErrors = [];
  let failedResources = [];
  let context;
  let page;
  const declarations = groups.reduce((sum, g) => sum + g.paths.length, 0);
  expect(declarations).toBe(105);
  try {
    for (const { group, paths } of groups.filter(g => g.group !== 'admin')) {
      for (const [routeIndex, route] of paths.entries()) {
        // Vite dev reloads fetch hundreds of modules. Dispose the entire context
        // every six routes instead of retaining tens of thousands of resources.
        // No retries: every route must still satisfy all assertions below.
        if (routeIndex % 6 === 0) {
          await context?.close();
          context = await browser.newContext({ baseURL: process.env.E2E_FRONTEND_URL || 'http://localhost:5173', viewport: { width: 1440, height: 1000 } });
          page = await context.newPage();
          page.on('requestfailed', request => failedResources.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
          page.on('pageerror', error => pageErrors.push(error.message));
          page.on('response', response => {
            const url = new URL(response.url());
            if (url.pathname.startsWith('/api')) requests.push({ path: url.pathname, status: response.status() });
          });
          if (['candidate', 'recruiter'].includes(group)) {
            const account = credentials()[group === 'candidate' ? 'student' : 'company'];
            await page.goto('/login');
            await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
            await page.locator('input[name="password"]').fill(account.password);
            await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
            await expect(page).toHaveURL(new RegExp(`/${group}/dashboard`));
          }
        }
      requests = []; pageErrors = []; failedResources = [];
      const actual = route.replace(/:(\w+)/g, (_, key) => substitutions[key]);
      const start = Date.now();
      await page.goto(actual);
      let settled = true;
      try { await page.waitForLoadState('networkidle', { timeout: 7000 }); } catch { settled = false; }
      try {
        await expect(page.locator('#main-content')).toBeVisible();
      } catch (error) {
        const document = await page.evaluate(() => ({ ready: document.readyState, rootLength: document.getElementById('root')?.innerHTML.length, scripts: [...document.scripts].map(s => s.getAttribute('src')), title: document.title }));
        writeLocal('route-failure.json', { route, actualUrl: new URL(page.url()).pathname, pageErrors, requests, failedResources, document });
        throw error;
      }
      const text = await page.locator('#main-content').innerText();
      expect(text.length).toBeGreaterThan(15);
      expect(pageErrors).toEqual([]);
      const actions = await page.locator('main button, main a').evaluateAll(elements => [...new Set(elements.map(e => (e.getAttribute('aria-label') || e.textContent || '').trim()).filter(Boolean))]);
      const inputs = await page.locator('main input, main textarea, main select').evaluateAll(elements => elements.map(e => ({ type: e.getAttribute('type') || e.tagName.toLowerCase(), name: e.getAttribute('name') || e.getAttribute('aria-label') || e.id, disabled: e.disabled })));
      const id = `${group}-${String(rows.length + 1).padStart(2, '0')}`;
      await page.screenshot({ path: path.join(local, 'routes', `${id}.png`) });
      rows.push({ id, role: group, route, actualUrl: new URL(page.url()).pathname, navigationOnly: true, settled, durationMs: Date.now() - start, actions, inputs, requests, unsupportedCopy: /chưa (hỗ trợ|sẵn sàng|có API)|không hỗ trợ/i.test(text) });
      writeLocal('route-evidence.json', { declarations, expected: 80, rows });
      }
    }
  } finally {
    await context?.close();
  }
  expect(rows).toHaveLength(80);
});
