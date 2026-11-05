import { test, expect } from '@playwright/test';
import { credentials, login, ok, readLocal, writeLocal } from '../helpers.mjs';

const manifest = readLocal('manifest.json');
const passwords = Object.values(credentials()).map(a => a.password);
const redact = value => passwords.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), String(value))
  .replace(/[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}/g, '[REDACTED_JWT]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]');
const evidence = { startedAt: new Date().toISOString(), source: 'real browser/backend; no HTTP mocking/retries', modes: [] };
const pathOf = url => { try { return new URL(url).pathname; } catch { return '<non-http>'; } };
let app;
test.beforeAll(async () => {
  app = (await ok('GET', `/students/me/applications?jobId=${manifest.jobs[0].id}`, await login('student')))[0];
  expect(app.status).toBe('REVIEWED'); // Read-only diagnostic; never transition a PRIMARY application.
});

async function instrument(page, record) {
  const pending = [];
  page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) record.console.push({ type: msg.type(), text: redact(msg.text()) }); });
  page.on('pageerror', error => record.pageErrors.push(redact(error.message)));
  page.on('requestfailed', r => record.failed.push({ path: pathOf(r.url()), error: r.failure()?.errorText }));
  page.on('response', response => {
    const path = pathOf(response.url());
    if (!['/api/auth/me', `/api/companies/me/applications/${app.id}`].includes(path)) return;
    pending.push((async () => {
      const headers = response.headers(), id = headers['x-request-id'];
      const row = { path, http: response.status(), requestId: /^[0-9a-f-]{36}$/i.test(id ?? '') ? id : null,
        contentType: headers['content-type'], authorizationPresent: Boolean(response.request().headers().authorization) };
      try {
        const result = await response.json();
        row.body = { success: result.success, errorCode: result.errorCode, dataKeys: result.data && typeof result.data === 'object' ? Object.keys(result.data) : [],
          ...(path === '/api/auth/me' ? { role: result.data?.role } : { applicationId: result.data?.id, applicationStatus: result.data?.status }) };
      } catch (error) { row.bodyReadError = redact(error.message); }
      record.responses.push(row);
    })());
  });
  await page.addInitScript(() => {
    const state = window.__b06Diagnostic = { documentId: crypto.randomUUID(), xhr: [], dom: [], lifecycle: [] };
    const isDetail = path => /^\/api\/companies\/me\/applications\/\d+$/.test(path);
    const original = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) {
      const path = new URL(String(args[1]), location.href).pathname;
      if (isDetail(path)) for (const event of ['load', 'error', 'abort', 'timeout', 'loadend']) this.addEventListener(event, () => {
        const row = { event, path, status: this.status, at: performance.now() };
        if (event === 'load') {
          try { const data = JSON.parse(this.responseText); row.success = data.success; row.statusValue = data.data?.status; row.hasData = !!data.data; }
          catch { row.jsonParseFailed = true; }
        }
        state.xhr.push(row);
      });
      return original.apply(this, args);
    };
    for (const event of ['pageshow', 'pagehide', 'DOMContentLoaded']) window.addEventListener(event, () => state.lifecycle.push({ event, at: performance.now() }));
    let last = '';
    const observe = () => {
      if (!location.pathname.startsWith('/recruiter/candidates/')) return;
      const text = document.body?.textContent ?? '';
      const row = { reviewed: text.includes('Đã xem'), error: text.includes('Không thể tải dữ liệu ứng tuyển.') || text.includes('Không tìm thấy hồ sơ ứng tuyển.'), loading: !!document.querySelector('[aria-busy="true"]') };
      const signature = JSON.stringify(row);
      if (signature !== last) { state.dom.push({ ...row, at: performance.now() }); last = signature; }
    };
    new MutationObserver(observe).observe(document, { childList: true, subtree: true });
  });
  return async () => { await Promise.all(pending); };
}
async function session(page) {
  return page.evaluate(async () => {
    const token = sessionStorage.getItem('job-system:auth-token');
    const digest = token ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)) : null;
    return { present: !!token, fingerprint: digest ? Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 12) : null };
  });
}
async function signIn(page) {
  const account = credentials().company;
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/recruiter/dashboard');
}
async function sample(page, record, label, navigate) {
  const round = { label, sessionBefore: await session(page) };
  record.rounds.push(round);
  try {
    const response = page.waitForResponse(r => pathOf(r.url()) === `/api/companies/me/applications/${app.id}` && r.request().method() === 'GET');
    await navigate();
    const received = await response, body = await received.json();
    expect(received.status()).toBe(200); expect(body.success).toBe(true); expect(body.data.status).toBe('REVIEWED');
    await expect(page.getByText('Đã xem', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Chi tiết ứng viên', exact: true })).toHaveCount(0);
    round.sessionAfter = await session(page);
    expect(round.sessionAfter).toEqual(round.sessionBefore);
    round.passed = true;
  } finally {
    round.path = pathOf(page.url());
    round.browser = await page.evaluate(() => ({ ...window.__b06Diagnostic,
      resources: performance.getEntriesByType('resource').length, jsHeap: performance.memory?.usedJSHeapSize,
      navigationType: performance.getEntriesByType('navigation')[0]?.type }));
  }
}

for (const mode of ['fresh-sessions', 'retained-reloads', 'route-remounts']) test(`D06 ${mode} — repeatable read-only B06 diagnosis`, async ({ browser }) => {
  const record = { mode, rounds: [], responses: [], console: [], pageErrors: [], failed: [] };
  evidence.modes.push(record);
  let context, flush;
  try {
    const sessions = mode === 'fresh-sessions' ? 6 : 1;
    for (let s = 0; s < sessions; s++) {
      context = await browser.newContext(); const page = await context.newPage(); flush = await instrument(page, record);
      await signIn(page); await page.goto(`/recruiter/candidates/${app.id}`);
      await expect(page.getByText('Đã xem', { exact: true }).first()).toBeVisible();
      const rounds = mode === 'fresh-sessions' ? 1 : 12;
      for (let n = 0; n < rounds; n++) {
        if (mode === 'route-remounts') {
          await page.goto('/recruiter/candidates');
          await sample(page, record, `${s + 1}.${n + 1}`, () => page.goto(`/recruiter/candidates/${app.id}`));
        } else await sample(page, record, `${s + 1}.${n + 1}`, () => page.reload());
        writeLocal('b06-diagnostic-evidence.json', evidence);
      }
      await flush(); await context.close(); context = null;
    }
    expect(record.pageErrors).toEqual([]);
  } catch (error) {
    record.failure = redact(error.message);
    throw new Error(record.failure);
  } finally {
    if (flush) await flush();
    if (context) await context.close();
    writeLocal('b06-diagnostic-evidence.json', evidence);
  }
});
