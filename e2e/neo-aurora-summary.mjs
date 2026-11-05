import fs from 'node:fs';
import { readLocal } from './helpers.mjs';

const performance = readLocal('neo-aurora-performance.json');
const browser = readLocal('neo-aurora-release-browser.json');
const median = values => [...values].sort((a,b) => a-b)[Math.floor(values.length / 2)];
const rows = [];
for (const route of new Set(performance.samples.map(s => s.route))) {
  for (const cache of ['cold','warm']) {
    const row = { route, cache };
    for (const phase of ['before','after']) {
      const samples = performance.samples.filter(s => s.route === route && s.cache === cache && s.phase === phase);
      row[phase] = { samples: samples.length, medianSettledMs: Math.round(median(samples.map(s => s.settledMs))), medianRequests: median(samples.map(s => s.requests)), medianApiRequests: median(samples.map(s => s.apiRequests)), medianJsRequests: median(samples.map(s => s.jsRequests)), maxCls: Math.max(...samples.map(s => s.cls)), maxLongTasks: Math.max(...samples.map(s => s.longTasks)), maxLongTaskMs: Math.round(Math.max(...samples.map(s => s.longTaskMs))) };
    }
    rows.push(row);
  }
}
const contrastPairs = [
  ['action', '#ffffff', '#5946d9'], ['action hover','#ffffff','#4934b8'],
  ['body','#17213a','#ffffff'], ['muted light','#52617b','#f5f8ff'],
  ['body dark','#f5f8ff','#111b30'], ['muted dark','#b9c6e0','#111b30'],
];
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(s => parseInt(s,16)/255).map(n => n<=0.04045?n/12.92:((n+0.055)/1.055)**2.4);
  return rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;
}
const metrics = { browser: performance.browser, environment: performance.environment, assets: performance.assets, rows,
  contrast: contrastPairs.map(([name,foreground,background]) => {
    const [a,b] = [luminance(foreground),luminance(background)].sort((a,b)=>b-a);
    return { name, foreground, background, ratio: Number(((a+0.05)/(b+0.05)).toFixed(2)) };
  }),
  visual: { routes: new Set(browser.screens.map(s=>s.route)).size, widths: [...new Set(browser.screens.map(s=>s.width))], screenshots: browser.screens.length, overflowingScreens: browser.screens.filter(s=>s.overflow).length, axeViolatingScreens: browser.screens.filter(s=>s.violations.length).length, pageErrors: browser.pageErrors.length, consoleErrors: browser.consoleErrors.length, interactions: browser.interactions },
};
fs.writeFileSync('docs/datn/neo-aurora-uiux-redesign-metrics.json', JSON.stringify(metrics,null,2)+'\n');
console.log(JSON.stringify(metrics));
