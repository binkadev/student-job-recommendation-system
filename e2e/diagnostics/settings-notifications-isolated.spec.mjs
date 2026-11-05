import { test, expect } from '@playwright/test';
import { readLocal, writeLocal } from '../helpers.mjs';

// Credentials and seeded records exist ONLY in a disposable PostgreSQL Testcontainer.
// Production notification generation rules are not changed to produce these cases.
const fixture = readLocal('settings-isolated-fixture.json');
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(fixture.backendUrl)) throw new Error('Isolated loopback fixture required');
const evidence = { fixture: 'disposable PostgreSQL Testcontainer', cases: {} };
async function request(method, path, token, body) {
  const response = await fetch(`${fixture.backendUrl}/api${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...await response.json() };
}
async function token(alias) {
  const account = fixture.accounts[alias];
  return (await request('POST', '/auth/login', null, { email: account.email, password: account.password })).data.token;
}
async function signIn(page, alias) {
  await page.goto('/login'); const account = fixture.accounts[alias];
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(alias === 'student' ? '/candidate/dashboard' : '/recruiter/dashboard');
}
const inboxPath = alias => alias === 'student' ? '/candidate/notifications' : '/recruiter/settings/notifications';
test.afterEach(() => writeLocal('settings-isolated-evidence.json', evidence));

for (const alias of ['company', 'student']) test(`I01 populated ${alias} inbox: filters, all pages, offline, read-one/read-all and persistence`, async ({ page, context }) => {
  const auth = await token(alias);
  await signIn(page, alias); await page.goto(inboxPath(alias));
  const region = page.getByRole('region', { name: 'Danh sách thông báo', exact: true });
  await expect(region.getByRole('article')).toHaveCount(10);
  await region.getByRole('button', { name: 'Sau', exact: true }).click();
  await expect(region.getByText(/Trang 2\//)).toBeVisible();
  const filtered = page.waitForResponse(r => new URL(r.url()).pathname === '/api/notifications' && new URL(r.url()).searchParams.get('type') === 'RECOMMENDATION');
  await page.getByLabel('Loại thông báo', { exact: true }).selectOption('RECOMMENDATION');
  expect((await (await filtered).json()).data.totalItems).toBe(12);
  await expect(region.getByText('Trang 1/2', { exact: true })).toBeVisible();
  await region.getByRole('button', { name: /^Chưa đọc/ }).click();
  await expect(region.getByText('8 thông báo phù hợp', { exact: true })).toBeVisible();
  const before = (await request('GET', '/notifications/unread-count', auth)).data.unreadCount;
  await context.setOffline(true);
  await region.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).first().click();
  await expect(region.getByRole('alert')).toContainText('Chưa xác nhận');
  await expect(region.getByRole('article')).toHaveCount(8);
  expect((await request('GET', '/notifications/unread-count', auth)).data.unreadCount).toBe(before);
  await context.setOffline(false);
  await region.getByRole('button', { name: 'Tải lại thông báo', exact: true }).click();
  await expect(region.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).first()).toBeEnabled();
  const read = page.waitForResponse(r => /\/api\/notifications\/\d+\/read$/.test(new URL(r.url()).pathname));
  await region.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).first().evaluate(el => { el.click(); el.click(); });
  const result = await read; expect(result.status()).toBe(200);
  const id = (await result.json()).data.id;
  await expect(region.getByText('7 thông báo phù hợp', { exact: true })).toBeVisible();
  const foreign = await request('PATCH', `/notifications/${id}/read`, await token('otherCompany'));
  expect(foreign.status).toBe(404);
  const all = page.waitForResponse(r => new URL(r.url()).pathname === '/api/notifications/read-all');
  await region.getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true }).click();
  expect((await all).status()).toBe(200); await page.reload();
  expect((await request('GET', '/notifications/unread-count', auth)).data.unreadCount).toBe(0);
  await expect(page.getByRole('link', { name: 'Xem thông báo, 0 chưa đọc', exact: true })).toBeVisible();
  evidence.cases[`I01-${alias}`] = { fixtureCount: alias === 'company' ? 51 : 48, filteredTotal: 12, unreadFiltered: 8, oneRead: 200, allRead: 200, persistedUnread: 0, foreign: 404, offlineRetained: true };
});

test('I02 Company opens closed, foreign and missing references through real target authorization', async ({ page }) => {
  await signIn(page, 'company');
  for (const [title, target, expected] of [
    ['closed job', `/jobs/${fixture.closedJobId}`, 200],
    ['foreign job', `/jobs/${fixture.foreignJobId}`, 403],
    ['missing application', '/companies/me/applications/2147483647', 404],
  ]) {
    await page.goto(inboxPath('company'));
    const row = page.getByRole('article', { name: `Isolated ${title}`, exact: true });
    await expect(row).toBeVisible();
    const received = page.waitForResponse(r => {
      const pathname = new URL(r.url()).pathname;
      return title === 'missing application' ? pathname.startsWith('/api/companies/me/applications/') : pathname === `/api${target}`;
    });
    await row.getByRole('button', { name: 'Mở', exact: true }).click();
    expect((await received).status()).toBe(expected);
    if (expected === 200) await expect(page.getByRole('heading', { name: 'Isolated closed job', exact: true })).toBeVisible();
    else await expect(page.getByRole('alert')).toBeVisible();
  }
  evidence.cases.I02 = { ownedClosedJob: 200, foreignDraftJob: 403, missingApplication: 404 };
});

for (const alias of ['company', 'student']) test(`I03 ${alias} signed expired JWT returns real 401 and clears the session`, async ({ page }) => {
  await signIn(page, alias); await page.goto(inboxPath(alias));
  await expect(page.getByRole('region', { name: 'Danh sách thông báo', exact: true })).toBeVisible();
  await page.evaluate(expired => sessionStorage.setItem('job-system:auth-token', expired), fixture.accounts[alias].expiredToken);
  const rejected = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/me');
  await page.reload(); expect((await rejected).status()).toBe(401);
  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate(() => sessionStorage.getItem('job-system:auth-token'))).toBeNull();
  await signIn(page, alias);
  evidence.cases[`I03-${alias}`] = { validSignatureExpiredToken: true, actual: 401, cleared: true, relogin: true };
});

test('I04 real Company commit followed by response loss retains draft and requires read-back before retry', async ({ page, context }) => {
  const auth = await token('company');
  const initial = (await request('GET', '/companies/me', auth)).data.companyName;
  await signIn(page, 'company'); await page.goto('/recruiter/settings/account');
  const input = page.getByLabel('Tên công ty', { exact: true });
  await expect(input).toHaveValue(initial);
  const name = 'Isolated committed response-loss draft'; await input.fill(name);
  const writes = []; page.on('request', r => { if (new URL(r.url()).pathname === '/api/companies/me' && r.method() === 'PUT') writes.push(1); });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  // Slow response bytes, never replace/fulfil an HTTP request. Node read-back is independent.
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: 64, uploadThroughput: 1_000_000 });
  try {
    await page.getByRole('button', { name: 'Lưu tài khoản', exact: true }).evaluate(el => el.click());
    await expect.poll(async () => (await request('GET', '/companies/me', auth)).data.companyName).toBe(name);
    await context.setOffline(true);
    await expect(page.getByRole('alert')).toContainText('Chưa xác nhận');
    await expect(input).toHaveValue(name);
    await expect(page.getByRole('button', { name: 'Lưu tài khoản', exact: true })).toBeDisabled();
    expect(writes).toHaveLength(1);
    expect(await page.getByText('Đã cập nhật tài khoản doanh nghiệp', { exact: true }).count()).toBe(0);
  } finally {
    await context.setOffline(false);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await cdp.detach();
  }
  await page.getByRole('button', { name: 'Đọc lại dữ liệu đã lưu', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Đối chiếu cài đặt' })).toContainText(name);
  await expect(input).toHaveValue(name); expect(writes).toHaveLength(1);
  await page.getByRole('button', { name: 'Thay bản nháp bằng dữ liệu đã lưu', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận thay bản nháp', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lưu tài khoản', exact: true })).toBeEnabled();
  evidence.cases.I04 = { commitVerifiedBeforeDisconnect: true, httpMocking: false, writes: 1, draftPreserved: true, noFalseSuccess: true, explicitReadBack: true };
});
