import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import { readLocal, writeLocal } from './helpers.mjs';

const credentials = readLocal('manual-final-credentials.json').accounts;
const output = { environment: 'Windows, headless Chromium, loopback real Backend; no throttling; 3 cold/warm pairs per route and build. Settled time includes networkidle (500ms); not INP or an SLA.', assets: {}, samples: [] };
const browser = await chromium.launch();
output.browser = browser.version();
try {
  for (const [phase, baseURL, dist] of [['before', 'http://127.0.0.1:5179', 'e2e/.local/neo-aurora-before-dist'], ['after', 'http://127.0.0.1:5177', 'frontend/dist']]) {
    const assets = fs.readdirSync(path.join(dist, 'assets')).filter(name => /\.(js|css)$/.test(name)).map(name => {
      const bytes = fs.readFileSync(path.join(dist, 'assets', name));
      return { name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
    });
    const entryName = fs.readFileSync(path.join(dist, 'index.html'), 'utf8').match(/src="\/assets\/([^"]+\.js)"/)[1];
    output.assets[phase] = { entry: assets.find(a => a.name === entryName), totalJsBytes: assets.filter(a => a.name.endsWith('.js')).reduce((n,a) => n+a.bytes, 0), totalJsGzip: assets.filter(a => a.name.endsWith('.js')).reduce((n,a) => n+a.gzipBytes, 0), charts: assets.filter(a => /BarChart/.test(a.name)), css: assets.filter(a => a.name.endsWith('.css')) };
    for (const [alias, route] of [['public','/'],['public','/login'],['student','/candidate/dashboard'],['student','/candidate/jobs/recommended'],['company','/recruiter/dashboard'],['company','/recruiter/reports']]) {
      for (let sample = 0; sample < 3; sample++) {
        const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        if (alias !== 'public') {
          await page.goto('/login');
          await page.getByRole('textbox', { name:'Email', exact:true }).fill(credentials[alias].email);
          await page.locator('input[name="password"]').fill(credentials[alias].password);
          await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
          await page.waitForURL(`**/${alias === 'student' ? 'candidate' : 'recruiter'}/dashboard`);
          await page.waitForLoadState('networkidle');
        }
        await page.addInitScript(() => {
          window.__neoPerf = { cls: 0, longTasks: 0, longTaskMs: 0 };
          for (const type of ['layout-shift','longtask']) new PerformanceObserver(list => {
            for (const e of list.getEntries()) {
              if(type === 'layout-shift' && !e.hadRecentInput) window.__neoPerf.cls += e.value;
              if(type === 'longtask') { window.__neoPerf.longTasks++; window.__neoPerf.longTaskMs += e.duration; }
            }
          }).observe({type,buffered:true});
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.clearBrowserCache');
        await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});
        for (const cache of ['cold','warm']) {
          const start = performance.now();
          if(cache === 'cold') await page.goto(route); else await page.reload();
          await page.waitForLoadState('networkidle');
          assert.ok(await page.locator('#main-content').isVisible());
          const metrics = await page.evaluate(() => ({ ...window.__neoPerf,
            requests: performance.getEntriesByType('resource').length,
            apiRequests: performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.startsWith('/api/')).length,
            jsRequests: performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.endsWith('.js')).length,
          }));
          output.samples.push({phase,route,sample,cache,settledMs:performance.now()-start,...metrics});
        }
        await context.close();
      }
      console.log(`Measured ${phase}: ${route}`);
    }
  }
} finally { await browser.close(); writeLocal('neo-aurora-performance.json', output); }
console.log(JSON.stringify({ samples: output.samples.length, assets: output.assets }));
