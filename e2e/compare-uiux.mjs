import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readLocal, writeLocal, local } from './helpers.mjs';
const before = readLocal('uiux-before-performance.json'), after = readLocal(`uiux-${process.argv[2] || 'after'}-performance.json`);
assert.equal(before.browser, after.browser, 'Browser versions differ');
assert.equal(before.metrics.length, after.metrics.length);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const bytes = row => row.resources.filter(r => r.path.endsWith('.js')).reduce((sum, r) => sum + r.transferBytes, 0);
const api = row => row.resources.filter(r => r.path.startsWith('/api/')).length;
const rows = [];
for (const name of new Set(before.metrics.map(row => row.name))) for (const cache of ['cold', 'warm']) {
  const a = before.metrics.filter(r => r.name === name && r.cache === cache), b = after.metrics.filter(r => r.name === name && r.cache === cache);
  assert.equal(a.length, 3); assert.equal(b.length, 3);
  assert.deepEqual(a.map(x => [x.hardwareConcurrency, x.devicePixelRatio]), b.map(x => [x.hardwareConcurrency, x.devicePixelRatio]));
  rows.push({ screen: name, cache, samples: 3, readyMsBefore: median(a.map(r => r.readyMs)), readyMsAfter: median(b.map(r => r.readyMs)),
    maxReadyMsBefore: Math.max(...a.map(r => r.readyMs)), maxReadyMsAfter: Math.max(...b.map(r => r.readyMs)),
    jsTransferBefore: median(a.map(bytes)), jsTransferAfter: median(b.map(bytes)), apiRequestsBefore: median(a.map(api)), apiRequestsAfter: median(b.map(api)),
    lcpBefore: median(a.map(r => r.lcp)), lcpAfter: median(b.map(r => r.lcp)), clsBefore: median(a.map(r => r.cls)), clsAfter: median(b.map(r => r.cls)) });
}
function entry(report, dist) {
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const name = html.match(/src="\/assets\/([^\"]+\.js)"/)[1];
  return report.assets.find(asset => asset.name === name);
}
const result = { browser: before.browser, environment: before.environment, cache: before.cache,
  entryBefore: entry(before, path.join(local, 'uiux-before-dist')), entryAfter: entry(after, path.resolve('../frontend/dist')),
  totalJsBefore: before.assets.filter(a => a.name.endsWith('.js')).reduce((n, a) => n + a.bytes, 0),
  totalJsAfter: after.assets.filter(a => a.name.endsWith('.js')).reduce((n, a) => n + a.bytes, 0), rows,
  axeViolationsBefore: before.accessibility.reduce((n, a) => n + a.violations.length, 0), axeViolationsAfter: after.accessibility.reduce((n, a) => n + a.violations.length, 0),
  auditScreens: after.accessibility.length, consoleAndPageErrorsBefore: before.errors.length, consoleAndPageErrorsAfter: after.errors.length };
writeLocal('uiux-comparison.json', result);
console.log(JSON.stringify({ entryBefore: result.entryBefore, entryAfter: result.entryAfter, totalJsBefore: result.totalJsBefore, totalJsAfter: result.totalJsAfter,
  cold: rows.filter(row => row.cache === 'cold'), axeViolationsBefore: result.axeViolationsBefore, axeViolationsAfter: result.axeViolationsAfter }));
