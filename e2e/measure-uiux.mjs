import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { login, readLocal, writeLocal, local } from './helpers.mjs';

const phase = process.argv[2];
if (!/^[a-z0-9-]+$/.test(phase ?? '')) throw Error('Supply a measurement phase');
const base = process.env.UIUX_BASE_URL || 'http://127.0.0.1:5176';
if (new URL(base).hostname !== '127.0.0.1') throw Error('Loopback only');
const filename = `uiux-${phase}-performance.json`;
if (fs.existsSync(path.join(local, filename))) throw Error('Do not replace a measurement baseline');
const manifest = readLocal('manifest.json');
const tokens = { student: await login('student'), company: await login('company') };
const screens = [
  ['login', null, '/login', 'h2', 'Chào mừng bạn quay lại'],
  ['student-dashboard', 'student', '/candidate/dashboard', 'main h1', null],
  ['student-profile', 'student', '/candidate/profile/edit', 'main h1', null],
  ['student-cvs', 'student', '/candidate/cvs', 'main h1', null],
  ['student-recommendations', 'student', '/candidate/jobs/recommended', 'main h1', null],
  ['company-dashboard', 'company', '/recruiter/dashboard', 'main h1', null],
  ['company-jobs', 'company', '/recruiter/jobs', 'main h1', null],
  ['company-ranking', 'company', `/recruiter/jobs/${manifest.jobs[1].id}/candidate-ranking`, 'main h1', null],
  ['company-reports', 'company', '/recruiter/reports', 'main h1', null],
  ['company-settings', 'company', '/recruiter/settings/account', 'main h1', null],
];
const browser = await chromium.launch();
const report = { phase, measuredAt: new Date().toISOString(), browser: browser.version(),
  environment: 'Windows; headless Chromium; loopback production Vite preview + unchanged real Backend/PostgreSQL; no CPU/network throttling',
  cache: 'Cold: new context, HTTP cache cleared and enabled. Warm: same context reload, cache enabled (may revalidate). readyMs precedes networkidle; settled resources follow networkidle.',
  metrics: [], accessibility: [], errors: [] };
const dist = process.env.UIUX_DIST || path.resolve('../frontend/dist');
report.assets = fs.readdirSync(path.join(dist, 'assets')).filter(name => /\.(js|css)$/.test(name)).map(name => {
  const bytes = fs.readFileSync(path.join(dist, 'assets', name)); return { name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
});
try {
  for (const [name, alias, route, selector, text] of screens) {
    for (let sample = 0; sample < 3; sample++) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      if (alias) await context.addInitScript(token => sessionStorage.setItem('job-system:auth-token', token), tokens[alias]);
      const page = await context.newPage();
      page.on('pageerror', error => report.errors.push({ screen: name, type: 'pageerror', message: error.message.replace(/[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/g, '[JWT]') }));
      page.on('console', message => { if (message.type() === 'error') report.errors.push({ screen: name, type: 'console', message: message.text().replace(/Bearer\s+\S+/g, 'Bearer [redacted]') }); });
      await page.addInitScript(() => {
        window.__uiux = { lcp: 0, cls: 0, longTasks: 0, longTaskMs: 0 };
        for (const type of ['largest-contentful-paint', 'layout-shift', 'longtask']) try {
          new PerformanceObserver(list => { for (const entry of list.getEntries()) {
            if (type === 'largest-contentful-paint') window.__uiux.lcp = entry.startTime;
            if (type === 'layout-shift' && !entry.hadRecentInput) window.__uiux.cls += entry.value;
            if (type === 'longtask') { window.__uiux.longTasks++; window.__uiux.longTaskMs += entry.duration; }
          } }).observe({ type, buffered: true });
        } catch { /* unsupported metric remains 0; Chromium version is recorded */ }
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable'); await cdp.send('Network.clearBrowserCache');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
      for (const cache of ['cold', 'warm']) {
        const started = performance.now();
        if (cache === 'cold') await page.goto(base + route); else await page.reload();
        const ready = text ? page.locator(selector).filter({ hasText: text }) : page.locator(selector).first();
        await ready.waitFor({ state: 'visible' });
        await page.locator('main').getByText('Đang tải dữ liệu...', { exact: true }).waitFor({ state: 'hidden' });
        const readyMs = performance.now() - started;
        await page.waitForLoadState('networkidle');
        const value = await page.evaluate(() => {
          const resources = performance.getEntriesByType('resource').map(r => ({ path: new URL(r.name).pathname,
            startMs: r.startTime, durationMs: r.duration, transferBytes: r.transferSize, encodedBytes: r.encodedBodySize, decodedBytes: r.decodedBodySize }));
          return { ...window.__uiux, resources, overflow: document.documentElement.scrollWidth > innerWidth,
            hardwareConcurrency: navigator.hardwareConcurrency, devicePixelRatio, domInteractive: performance.getEntriesByType('navigation')[0].domInteractive };
        });
        report.metrics.push({ name, route, sample, cache, readyMs, ...value });
      }
      if (sample === 0) for (const width of [375, 430, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const axe = await new AxeBuilder({ page }).analyze();
        report.accessibility.push({ name, width, overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          violations: axe.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target), failureSummaries: v.nodes.map(n => n.failureSummary) })) });
        await page.screenshot({ path: path.join(local, `uiux-${phase}-${name}-${width}.png`), fullPage: true });
      }
      await context.close();
    }
    console.log(`Measured ${name} cold/warm x3 + five viewport axe/screenshots (read-only)`);
  }
} finally { await browser.close(); writeLocal(filename, report); }
console.log(JSON.stringify({ phase, measurements: report.metrics.length, audits: report.accessibility.length, errors: report.errors.length,
  overflowScreens: report.accessibility.filter(x => x.overflow).length, violationRules: [...new Set(report.accessibility.flatMap(x => x.violations.map(v => v.id)))] }));
