import { test, expect } from '@playwright/test';
import { readLocal, writeLocal } from '../helpers.mjs';

const fixture = readLocal('reliability-isolated-fixture.json');
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(fixture.backendUrl)) throw new Error('Disposable loopback fixture required');
const evidence = { stack: 'disposable PostgreSQL + real AI image + loopback transport faults', cases: {} };
async function request(method, path, token, body, headers = {}) {
  const response = await fetch(`${fixture.backendUrl}/api${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(50_000) });
  return { status: response.status, etag: response.headers.get('ETag'), ...await response.json() };
}
async function login(alias) {
  const { email, password } = fixture.accounts[alias];
  return (await request('POST', '/auth/login', null, { email, password })).data.token;
}
async function control(command) {
  expect((await fetch(`${fixture.backendUrl}/control`, { method: 'POST', body: command })).status).toBe(200);
}
const db = async () => (await fetch(`${fixture.backendUrl}/evidence`)).json();
const routes = role => role === 'student' ? {
  generate: '/students/me/recommendations/generate', runs: '/students/me/recommendation-runs',
  body: { cvId: fixture.cvId, threshold: 0, limit: 10 }, table: 'recommendation',
  page: '/candidate/jobs/recommended', button: 'Cập nhật gợi ý',
} : {
  generate: `/companies/me/jobs/${fixture.jobId}/candidate-ranking-runs`,
  runs: `/companies/me/jobs/${fixture.jobId}/candidate-ranking-runs`,
  body: { threshold: 0, primaryLimit: 10, fallbackLimit: 10 }, table: 'candidate_ranking',
  page: `/recruiter/jobs/${fixture.jobId}/candidate-ranking`, button: /^(Chạy lại|Chạy xếp hạng)$/,
};
const runRows = (response, role) => role === 'student' ? response.data : response.data.items;
const detail = async (role, token, id) => (await request('GET', `${routes(role).runs}/${id}`, token)).data;
function valid(detail) {
  expect(detail.status).toBe('SUCCESS'); expect(detail.results.length).toBeGreaterThan(0);
  for (const row of detail.results) {
    expect(row.rankingScore).not.toBeNull(); expect(row.tierRankPosition).toBeGreaterThan(0);
    if (row.rankingTier === 'PRIMARY') { expect(row.scoringStrategy).toBe('SAME_LANGUAGE_HYBRID'); expect(row.overallScore).toBe(row.rankingScore); expect(row.textScore).not.toBeNull(); }
    else { expect(row.rankingTier).toBe('FALLBACK'); expect(row.scoringStrategy).toBe('CROSS_LANGUAGE_SKILL_BASED'); expect(row.overallScore).toBeNull(); expect(row.textScore).toBeNull(); expect(row.rankingScore).toBe(row.skillScore); }
  }
}
async function signIn(page, alias) {
  const account = fixture.accounts[alias];
  await page.goto('/login'); await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(alias.toLowerCase().includes('student') ? '/candidate/dashboard' : '/recruiter/dashboard');
}
test.afterEach(async () => { await control('ai:pass'); await control('public:pass'); writeLocal('reliability-isolated-evidence.json', evidence); });

for (const role of ['student', 'company']) for (const fault of ['offline', '500', '503', 'slow', 'reset', 'malformed', 'missing']) {
  test(`R01 ${role} real V3 ${fault}: FAILED without results, preserve SUCCESS, recover`, async () => {
    const token = await login(role), route = routes(role);
    await control('ai:pass');
    const original = await request('POST', route.generate, token, route.body);
    expect(original.status).toBe(200); valid(original.data);
    const before = await db();
    await control(`ai:${fault}`);
    const started = Date.now(), failed = await request('POST', route.generate, token, route.body);
    expect([502, 503, 504]).toContain(failed.status); expect(failed.success).toBe(false);
    expect(failed.errorCode).toBe(['malformed', 'missing'].includes(fault) ? 'AI_SERVICE_INVALID_RESPONSE' : fault === 'slow' ? 'AI_SERVICE_TIMEOUT' : 'AI_SERVICE_UNAVAILABLE');
    expect(Date.now() - started).toBeLessThan(25_000);
    const latest = runRows(await request('GET', route.runs, token), role)[0];
    const failedDetail = await detail(role, token, latest.id);
    expect(failedDetail.status).toBe('FAILED'); expect(failedDetail.results).toEqual([]);
    expect(await detail(role, token, original.data.id)).toEqual(original.data);
    const after = await db();
    expect(after.cvs).toEqual(before.cvs);
    expect(after[`${route.table}_results`]).toEqual(before[`${route.table}_results`]);
    expect(after.publicGenerations - before.publicGenerations).toBe(1); expect(after.jwtLeaks).toBe(0);
    await control('ai:pass');
    const recovered = await request('POST', route.generate, token, route.body);
    expect(recovered.status).toBe(200); valid(recovered.data);
    evidence.cases[`${role}-${fault}`] = { http: failed.status, code: failed.errorCode, failedRunId: latest.id, oldSuccessPreserved: true, failedResults: 0, cvUnchanged: true, recovery: 200 };
  });
}

for (const role of ['student', 'company']) test(`R02 ${role} simultaneous requests retain official independent runs`, async () => {
  const token = await login(role), route = routes(role), before = await db();
  await control('ai:hold');
  const first = request('POST', route.generate, token, route.body);
  await expect.poll(async () => (await db())[`${route.table}_runs`].filter(row => row.status === 'PROCESSING').length).toBe(1);
  const second = request('POST', route.generate, token, route.body);
  const responses = await Promise.all([first, second]);
  expect(responses.map(row => row.status).sort()).toEqual(role === 'student' ? [200, 200] : [200, 409]);
  for (const row of responses.filter(row => row.status === 200)) valid(row.data);
  const after = await db();
  expect(after[`${route.table}_runs`].length - before[`${route.table}_runs`].length).toBe(role === 'student' ? 2 : 1);
  expect(after[`${route.table}_runs`].some(row => row.status === 'PROCESSING')).toBe(false);
  evidence.cases[`${role}-parallel`] = { statuses: responses.map(row => row.status), studentCreatesIndependentRuns: role === 'student' };
});

for (const role of ['student', 'company']) for (const fault of ['503', 'drop', 'delay']) test(`R03 ${role} browser ${fault}: finite loading, read persisted runs before retry`, async ({ page }) => {
  const route = routes(role), token = await login(role);
  await signIn(page, role); await page.goto(route.page);
  if (role === 'student') { await page.getByLabel('CV dùng để gợi ý', { exact: true }).selectOption(String(fixture.cvId)); }
  const generate = page.getByRole('button', { name: route.button, exact: true });
  await expect(generate).toBeEnabled();
  const before = await db();
  await control(fault === '503' ? 'ai:503' : `public:${fault}`);
  const finished = fault === 'delay'
    ? page.waitForEvent('requestfailed', { predicate: req => new URL(req.url()).pathname.endsWith(route.generate) })
    : page.waitForResponse(r => new URL(r.url()).pathname.endsWith(route.generate) && r.request().method() === 'POST');
  await generate.click();
  // Browser's existing 40s request timeout is exercised; no assertion/timeout inflation.
  await finished;
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa xác nhận được kết quả yêu cầu' })).toBeVisible();
  await expect(generate).toBeDisabled();
  if (fault === '503') for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole('button', { name: 'Đọc lại lịch sử trước khi thử lại', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/reliability-${role}-recovery-${width}.png`, fullPage: true });
  }
  const after = await db(); expect(after.publicGenerations - before.publicGenerations).toBe(1);
  const latest = runRows(await request('GET', route.runs, token), role)[0];
  expect(latest.status).toBe(fault === '503' ? 'FAILED' : 'SUCCESS');
  await control('ai:pass');
  await page.getByRole('button', { name: 'Đọc lại lịch sử trước khi thử lại', exact: true }).click();
  await expect(generate).toBeEnabled();
  expect((await db()).publicGenerations).toBe(after.publicGenerations);
  await page.reload(); await expect(generate).toBeEnabled();
  const recovered = page.waitForResponse(r => new URL(r.url()).pathname.endsWith(route.generate) && r.request().method() === 'POST');
  await generate.evaluate(button => { button.click(); button.click(); });
  expect((await recovered).status()).toBe(200);
  await expect.poll(async () => (await db()).publicGenerations).toBe(after.publicGenerations + 1);
  expect(runRows(await request('GET', route.runs, token), role)[0].status).toBe('SUCCESS');
  evidence.cases[`${role}-browser-${fault}`] = { writes: 1, observedPersistedStatus: latest.status, readBackBeforeRetry: true, noAutomaticPostRetry: true };
});

for (const type of ['account', 'preferences']) test(`R04 two real tabs ${type}: stale 409 retains both draft and winner`, async ({ browser }) => {
  const token = await login('company'), contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map(context => context.newPage()));
  const path = type === 'account' ? '/companies/me' : '/users/me/notification-settings';
  try {
    for (const page of pages) { await signIn(page, 'company'); await page.goto(`/recruiter/settings/${type === 'account' ? 'account' : 'notifications'}`); }
    const initial = await request('GET', path, token);
    const button = type === 'account' ? 'Lưu tài khoản' : 'Lưu cài đặt thông báo';
    if (type === 'account') {
      await pages[0].getByLabel('Tên công ty', { exact: true }).fill('CAS winner A');
      await pages[1].getByLabel('Tên công ty', { exact: true }).fill('CAS retained draft B');
    } else {
      await pages[0].getByRole('switch', { name: 'Thông báo hệ thống', exact: true }).click();
      await pages[1].getByRole('switch', { name: 'Thông báo trạng thái ứng tuyển', exact: true }).click();
    }
    for (let i = 0; i < 2; i++) {
      const response = pages[i].waitForResponse(r => new URL(r.url()).pathname === `/api${path}` && r.request().method() === 'PUT');
      await pages[i].getByRole('button', { name: button, exact: true }).click();
      expect((await response).status()).toBe(i === 0 ? 200 : 409);
    }
    const persisted = await request('GET', path, token);
    expect(persisted.data.revision).toBe(initial.data.revision + 1);
    await expect(pages[1].getByRole('button', { name: button, exact: true })).toBeDisabled();
    if (type === 'account') { expect(persisted.data.companyName).toBe('CAS winner A'); await expect(pages[1].getByLabel('Tên công ty', { exact: true })).toHaveValue('CAS retained draft B'); }
    else { expect(persisted.data.applicationStatusEnabled).toBe(initial.data.applicationStatusEnabled); expect(persisted.data.systemEnabled).toBe(!initial.data.systemEnabled); }
    await pages[1].getByRole('button', { name: 'Đọc lại dữ liệu đã lưu', exact: true }).click();
    await expect(pages[1].getByRole('button', { name: button, exact: true })).toBeDisabled();
    if (type === 'account') await expect(pages[1].getByLabel('Tên công ty', { exact: true })).toHaveValue('CAS retained draft B');
    expect((await request('GET', path, token)).data).toEqual(persisted.data);
    const database = await db(); expect(database.company[0].status).toBe('VERIFIED');
    evidence.cases[`two-tabs-${type}`] = { winner: 200, stale: 409, revisionIncrement: 1, draftRetainedAfterGet: true, noImplicitRebase: true };
  } finally { for (const context of contexts) await context.close(); }
});

test('R05 real expired JWT returns 401; late successful response cannot cross Student/Company sessions', async ({ page }) => {
  await signIn(page, 'student');
  await page.goto('/candidate/settings/account'); await expect(page.getByLabel('Họ tên', { exact: true })).not.toHaveValue('');
  const expired = await request('GET', '/students/me', fixture.accounts.student.expiredToken);
  expect(expired.status).toBe(401);
  await control('public:hold');
  const pending = page.evaluate(async () => {
    const { httpClient } = await import('/src/services/api/httpClient.ts');
    try { await httpClient.get('/students/me'); return 'accepted'; } catch { return 'discarded'; }
  });
  await expect.poll(async () => (await db()).heldRequests).toBe(1);
  const companyToken = await login('company');
  await page.evaluate(async token => { const { storeToken } = await import('/src/services/auth/authService.ts'); storeToken(token); }, companyToken);
  expect(await pending).toBe('discarded');
  expect(await page.evaluate(async () => { const { httpClient } = await import('/src/services/api/httpClient.ts'); return (await httpClient.get('/auth/me')).data.data.role; })).toBe('COMPANY');
  evidence.cases.session = { realExpiredJwt: 401, lateSuccessDiscarded: true, newCompanySessionRetained: true };
});

test('R06 late real 401 from expired Student token cannot clear a new Company session', async ({ page }) => {
  await signIn(page, 'student');
  await page.goto('/candidate/settings/account'); await expect(page.getByLabel('Họ tên', { exact: true })).not.toHaveValue('');
  await control('public:hold');
  const pending = page.evaluate(async expired => {
    const { httpClient } = await import('/src/services/api/httpClient.ts');
    const { storeToken } = await import('/src/services/auth/authService.ts');
    storeToken(expired);
    try { await httpClient.get('/students/me'); return 200; } catch (error) { return error.response?.status; }
  }, fixture.accounts.student.expiredToken);
  await expect.poll(async () => (await db()).heldRequests).toBe(1);
  const token = await login('company');
  await page.evaluate(async token => { const { storeToken } = await import('/src/services/auth/authService.ts'); storeToken(token); }, token);
  expect(await pending).toBe(401);
  expect(await page.evaluate(async () => { const { httpClient } = await import('/src/services/api/httpClient.ts'); return (await httpClient.get('/auth/me')).data.data.role; })).toBe('COMPANY');
  expect((await request('GET', '/auth/me', 'malformed.invalid.token')).status).toBe(401);
  evidence.cases.late401 = { expiredOldToken: 401, invalidToken: 401, newSessionRetained: true };
});
