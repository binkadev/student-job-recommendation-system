import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { local, readLocal, writeLocal } from './helpers.mjs';

const phase = process.argv[2];
assert.match(phase ?? '', /^[a-z0-9-]+$/);
const output = `neo-aurora-${phase}-browser.json`;
assert.ok(!fs.existsSync(path.join(local, output)), 'Do not overwrite evidence');
const accounts = readLocal('manual-final-credentials.json').accounts;
const state = readLocal('manual-final-state.json');
const baseURL = 'http://127.0.0.1:5177';
const directory = path.join(local, `neo-aurora-${phase}`);
fs.mkdirSync(directory, { recursive: true });
const dist = path.resolve('frontend/dist');
const assets = fs.readdirSync(path.join(dist, 'assets')).filter(n => /\.(css|js)$/.test(n)).map(name => {
  const bytes = fs.readFileSync(path.join(dist, 'assets', name));
  return { name, bytes: bytes.length, gzip: gzipSync(bytes).length };
});
const evidence = { phase, measuredAt: new Date().toISOString(), assets, screens: [], requests: [], pageErrors: [], consoleErrors: [], interactions: [] };
const browser = await chromium.launch();
evidence.browser = browser.version();
async function session(alias) {
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', e => evidence.pageErrors.push({ alias, message: e.message }));
  page.on('console', m => { if (m.type() === 'error') evidence.consoleErrors.push({ alias, message: m.text() }); });
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) {
      const method = request.method();
      evidence.requests.push({ alias, path: url.pathname, method });
      assert.ok(['GET', 'HEAD', 'OPTIONS'].includes(method) || (method === 'POST' && url.pathname === '/api/auth/login'), `Unexpected mutation ${method} ${url.pathname}`);
    }
  });
  if (alias !== 'public') {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(accounts[alias].email);
    await page.locator('input[name="password"]').fill(accounts[alias].password);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL(`/${alias === 'student' ? 'candidate' : 'recruiter'}/dashboard`);
  }
  return { page, context };
}
const cv = state.cvs.student[0].id;
// Choose an actual owned job from the persisted fixture; never generate a run.
const jobs = Object.values(state.jobs);
const job = jobs.find(j => j.id && j.status === 'ACTIVE') ?? jobs[0];
const routes = {
  public: ['/', '/jobs', '/companies', '/login', '/register', '/register/candidate', '/register/recruiter'],
  student: ['/candidate/dashboard', '/candidate/profile', '/candidate/profile/edit', '/candidate/profile/preferences', '/candidate/cvs', `/candidate/cvs/${cv}/analysis`, '/candidate/jobs/recommended', '/candidate/jobs', '/candidate/jobs/saved', '/candidate/applications', '/candidate/notifications', '/candidate/settings/account'],
  company: ['/recruiter/dashboard', '/recruiter/jobs', '/recruiter/jobs/create', '/recruiter/candidates', `/recruiter/jobs/${job.id}/candidate-ranking`, '/recruiter/reports', '/recruiter/company', '/recruiter/company/edit', '/recruiter/settings/account'],
};
try {
  for (const [alias, paths] of Object.entries(routes)) {
    const { page, context } = await session(alias);
    for (const route of paths) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.addInitScript(() => {
        window.__neoMetrics = { cls: 0, longTasks: 0, longTaskMs: 0 };
        for (const type of ['layout-shift', 'longtask']) new PerformanceObserver(list => {
          for (const e of list.getEntries()) {
            if (type === 'layout-shift' && !e.hadRecentInput) window.__neoMetrics.cls += e.value;
            if (type === 'longtask') { window.__neoMetrics.longTasks++; window.__neoMetrics.longTaskMs += e.duration; }
          }
        }).observe({ type, buffered: true });
      });
      const started = performance.now();
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('#main-content')).toBeVisible();
      assert.equal(new URL(page.url()).pathname, route);
      const coldReadyMs = performance.now() - started;
      const metrics = await page.evaluate(() => ({ ...window.__neoMetrics, requests: performance.getEntriesByType('resource').length, apiRequests: performance.getEntriesByType('resource').filter(r => new URL(r.name).pathname.startsWith('/api/')).length }));
      const warmStart = performance.now();
      await page.reload(); await page.waitForLoadState('networkidle');
      const warmReadyMs = performance.now() - warmStart;
      for (const width of phase === 'before' ? [375, 1440] : [375, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const slug = route === '/' ? 'home' : route.slice(1).replaceAll('/', '-');
        const screenshot = `${slug}-${width}.png`;
        await page.screenshot({ path: path.join(directory, screenshot), fullPage: true });
        const axe = await new AxeBuilder({ page }).analyze();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        evidence.screens.push({ alias, route, width, screenshot, coldReadyMs, warmReadyMs, ...metrics, overflow,
          violations: axe.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })) });
      }
      writeLocal(output, evidence);
      console.log(`${phase}: ${alias} ${route}`);
    }
    if (phase !== 'before') {
      await page.setViewportSize({ width: 375, height: 900 });
      if (alias === 'public') {
        await page.goto('/'); await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
        await expect(page.getByRole('navigation', { name: 'Điều hướng điện thoại' })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Mở menu', exact: true })).toBeFocused();
      } else {
        await page.getByRole('button', { name: 'Mở menu điều hướng' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('button', { name: 'Mở menu điều hướng' })).toBeFocused();
      }
      evidence.interactions.push({ alias, mobileMenuEscapeFocus: true });
      assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('main')).animationName), 'none');
      evidence.interactions.push({ alias, reducedMotionDisablesRouteEntrance: true });
    }
    await context.close();
  }
} finally { await browser.close(); writeLocal(output, evidence); }
console.log(JSON.stringify({ screens: evidence.screens.length, overflow: evidence.screens.filter(s => s.overflow).length, axe: evidence.screens.filter(s => s.violations.length).length, pageErrors: evidence.pageErrors.length, consoleErrors: evidence.consoleErrors.length }));
if (phase !== 'before') {
  assert.equal(evidence.screens.filter(s => s.overflow || s.violations.length).length, 0, 'Resolve layout and accessibility failures before acceptance');
  assert.deepEqual(evidence.pageErrors, []);
  assert.deepEqual(evidence.consoleErrors, []);
}
