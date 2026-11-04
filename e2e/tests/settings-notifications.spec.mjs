import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { api, ok, login, credentials, devAdmin, writeLocal, local } from '../helpers.mjs';

// All HTTP is real. Only secondary accounts are mutated; no SQL fixture writes to the demo DB.
const evidence = { cases: {}, http: [], pageErrors: [], limitations: [] };
const prefRoute = '/users/me/notification-settings';
const flags = ['applicationStatusEnabled', 'jobStatusEnabled', 'recommendationEnabled', 'systemEnabled'];
const pick = (data, keys = flags) => Object.fromEntries(keys.map(key => [key, data[key]]));
const roleFor = alias => alias === 'companyUi' ? 'recruiter' : 'candidate';
async function signIn(page, alias, password = credentials()[alias].password) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(credentials()[alias].email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(`/${roleFor(alias)}/dashboard`);
}
async function signOut(page) {
  await page.getByRole('button', { name: 'Menu tài khoản', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL('/login');
}
function response(page, route, method = 'GET') {
  return page.waitForResponse(r => new URL(r.url()).pathname === `/api${route}` && r.request().method() === method);
}
async function settings(page, alias, section) {
  await page.goto(`/${roleFor(alias)}/settings/${section}`);
}
async function save(page, route, button) {
  const received = response(page, route, 'PUT');
  await page.getByRole('button', { name: button, exact: true }).evaluate(el => { el.click(); el.click(); });
  expect((await received).status()).toBe(200);
}
async function replaceReviewed(page) {
  await page.getByRole('button', { name: 'Đọc lại dữ liệu đã lưu', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Đối chiếu cài đặt' })).toBeVisible();
  await page.getByRole('button', { name: 'Thay bản nháp bằng dữ liệu đã lưu', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận thay bản nháp', exact: true }).click();
}
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => evidence.pageErrors.push(error.message));
  page.on('response', r => {
    const url = new URL(r.url());
    if (url.pathname.startsWith('/api/') && /notifications|notification-settings|password|\/students\/me$|\/companies\/me$/.test(url.pathname)) {
      evidence.http.push({ method: r.request().method(), path: url.pathname, query: url.search, status: r.status() });
    }
  });
});
test.afterEach(() => writeLocal('settings-notifications-evidence.json', evidence));

for (const alias of ['studentUi', 'companyUi']) {
  const role = roleFor(alias);
  test(`N01 ${role} account save/read-back, double submit and offline draft recovery`, async ({ page, context }) => {
    const token = await login(alias), route = role === 'candidate' ? '/students/me' : '/companies/me';
    const initial = await api('GET', route, token);
    const field = role === 'candidate' ? 'fullName' : 'companyName';
    const label = role === 'candidate' ? 'Họ tên' : 'Tên công ty';
    const button = role === 'candidate' ? 'Cập nhật thông tin' : 'Lưu tài khoản';
    const value = `Settings secondary ${role} ${randomUUID().slice(0, 6)}`;
    try {
      await signIn(page, alias); await settings(page, alias, 'account');
      const input = page.getByLabel(label, { exact: true }); await expect(input).toHaveValue(initial.data[field]);
      await input.fill(value);
      const writes = []; page.on('request', r => { if (new URL(r.url()).pathname === `/api${route}` && r.method() === 'PUT') writes.push(1); });
      await save(page, route, button);
      await expect(page.getByText(role === 'candidate' ? 'Đã cập nhật thông tin tài khoản' : 'Đã cập nhật tài khoản doanh nghiệp', { exact: true })).toBeVisible();
      expect(writes).toHaveLength(1);
      expect((await ok('GET', route, token))[field]).toBe(value);
      await page.reload(); await expect(input).toHaveValue(value);
      await input.fill(`${value} offline draft`); await context.setOffline(true);
      await page.getByRole('button', { name: button, exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Chưa xác nhận');
      await expect(input).toHaveValue(`${value} offline draft`);
      await expect(page.getByRole('button', { name: button, exact: true })).toBeDisabled();
      expect((await ok('GET', route, token))[field]).toBe(value);
      await context.setOffline(false); await replaceReviewed(page);
      await expect(input).toHaveValue(value);
      await expect(page.getByRole('button', { name: button, exact: true })).toBeEnabled();
      if (role === 'recruiter') {
        expect((await ok('GET', route, token)).status).toBe(initial.data.status);
        expect(await page.getByRole('combobox').count()).toBe(0);
      }
      evidence.cases[`N01-${role}`] = { saved: 200, doubleSubmitWrites: 1, offlineDraftRetained: true, readBackBeforeRetry: true, verificationUnchanged: true };
    } finally {
      await context.setOffline(false);
      const current = await api('GET', route, token);
      await ok('PUT', route, token, { [field]: initial.data[field] }, role === 'candidate' ? { 'If-Match': current.etag } : {});
    }
  });

  test(`N02 ${role} notification preferences persist and offline does not overwrite draft`, async ({ page, context }) => {
    const token = await login(alias), initial = pick(await ok('GET', prefRoute, token));
    try {
      await signIn(page, alias); await settings(page, alias, 'notifications');
      const control = page.getByRole('switch', { name: 'Thông báo hệ thống', exact: true });
      await expect(control).toHaveAttribute('aria-checked', String(initial.systemEnabled));
      await control.click(); const wanted = { ...initial, systemEnabled: !initial.systemEnabled };
      await save(page, prefRoute, 'Lưu cài đặt thông báo');
      await expect(page.getByText('Đã lưu cài đặt thông báo', { exact: true })).toBeVisible();
      expect(pick(await ok('GET', prefRoute, token))).toEqual(wanted);
      await page.reload(); await expect(control).toHaveAttribute('aria-checked', String(wanted.systemEnabled));
      await control.click(); await context.setOffline(true);
      await page.getByRole('button', { name: 'Lưu cài đặt thông báo', exact: true }).click();
      await expect(page.getByRole('alert')).toContainText('Chưa xác nhận');
      await expect(control).toHaveAttribute('aria-checked', String(initial.systemEnabled));
      await context.setOffline(false); await replaceReviewed(page);
      await expect(control).toHaveAttribute('aria-checked', String(wanted.systemEnabled));
      evidence.cases[`N02-${role}`] = { persistedAllFourFlags: true, offlineDraftRetained: true, explicitReadBack: true };
    } finally { await context.setOffline(false); await ok('PUT', prefRoute, token, initial); }
  });

  test(`N03 ${role} secondary password change, login and restore`, async ({ page }) => {
    const account = credentials()[alias], original = account.password;
    const next = `${original.slice(0, 55)}Q7!`;
    const token = await login(alias);
    let changed = false;
    try {
      await signIn(page, alias); await settings(page, alias, 'security');
      await expect(page.getByText('Xác thực hai bước chưa được hệ thống hỗ trợ.', { exact: true })).toBeVisible();
      expect(await page.getByRole('switch').count()).toBe(0);
      await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill('Wrong-secondary-password!');
      await page.getByLabel('Mật khẩu mới', { exact: true }).fill(next);
      await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(next);
      const wrong = response(page, '/users/me/password', 'PATCH');
      await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).click();
      expect((await wrong).status()).toBe(400);
      await expect(page.getByRole('alert')).toContainText('Mật khẩu hiện tại không đúng');
      await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill(original);
      const saved = response(page, '/users/me/password', 'PATCH');
      await page.getByRole('button', { name: 'Đổi mật khẩu', exact: true }).evaluate(el => { el.click(); el.click(); });
      expect((await saved).status()).toBe(200); changed = true;
      await expect(page.getByText('Đã đổi mật khẩu', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Mật khẩu mới', { exact: true })).toHaveValue('');
      expect((await api('POST', '/auth/login', null, { email: account.email, password: original })).status).toBe(401);
      await signOut(page); await signIn(page, alias, next);
      expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(next);
      expect(await page.evaluate(() => JSON.stringify(sessionStorage))).not.toContain(next);
      evidence.cases[`N03-${role}`] = { wrongCurrent: 400, change: 200, oldLogin: 401, newBrowserLogin: true, twoFactorUnsupported: true };
    } finally {
      // JWT remains valid by contract. Restore with known new password, never touch PRIMARY credentials.
      if (changed) await ok('PATCH', '/users/me/password', token, { currentPassword: next, newPassword: original });
      expect((await api('POST', '/auth/login', null, { email: account.email, password: original })).status).toBe(200);
    }
  });
}

test('N04 Student real application notifications: pagination, filters, offline, open, read/read-all, reload and badge', async ({ page, context }) => {
  const student = await login('frontend'), owner = await login('companyB'), admin = await devAdmin();
  if (!admin) throw new Error('Notification fixture requires existing dev Admin APIs.');
  const settingsBefore = pick(await ok('GET', prefRoute, student));
  let job;
  try {
    await ok('PUT', prefRoute, student, { ...settingsBefore, applicationStatusEnabled: true });
    job = await ok('POST', '/jobs', owner, { title: `Notifications secondary [${randomUUID().slice(0, 8)}]`, description: 'Synthetic notification QA only. Java Git SQL internship with mentoring.', requirements: 'Git SQL', location: 'Hà Nội', jobType: 'INTERNSHIP', workingModel: 'HYBRID', deadline: '2099-12-31', status: 'DRAFT', skills: [] });
    await ok('PATCH', `/jobs/${job.id}/status`, owner, { status: 'PENDING_APPROVAL' });
    await ok('PATCH', `/jobs/${job.id}/status`, admin, { status: 'ACTIVE' });
    for (let round = 0; round < 6; round++) {
      const application = await ok('POST', `/jobs/${job.id}/apply`, student, { coverLetter: 'Secondary notifications regression' });
      await ok('PATCH', `/applications/${application.id}/status`, owner, { status: 'REVIEWED' });
      await ok('PATCH', `/applications/${application.id}/status`, owner, { status: 'REJECTED' });
    }
    await ok('PATCH', `/jobs/${job.id}/status`, owner, { status: 'CLOSED' });
    const unreadBefore = (await ok('GET', '/notifications/unread-count', student)).unreadCount;
    expect(unreadBefore).toBeGreaterThanOrEqual(12);
    await signIn(page, 'frontend'); await page.goto('/candidate/notifications');
    const inbox = page.getByRole('region', { name: 'Danh sách thông báo', exact: true });
    await expect(inbox.getByRole('article')).toHaveCount(10);
    const paged = page.waitForResponse(r => new URL(r.url()).pathname === '/api/notifications' && new URL(r.url()).searchParams.get('page') === '2');
    await page.getByRole('button', { name: 'Sau', exact: true }).click();
    expect((await paged).status()).toBe(200);
    const empty = page.waitForResponse(r => new URL(r.url()).searchParams.get('type') === 'SYSTEM');
    await page.getByLabel('Loại thông báo', { exact: true }).selectOption('SYSTEM');
    const filtered = (await (await empty).json()).data;
    expect(filtered.page).toBe(1); expect(filtered.totalItems).toBe(0);
    await expect(page.getByText('Không có thông báo phù hợp.', { exact: true })).toBeVisible();
    await page.getByLabel('Loại thông báo', { exact: true }).selectOption('APPLICATION_STATUS_CHANGED');
    await page.getByRole('button', { name: `Chưa đọc (${unreadBefore})`, exact: true }).click();
    await expect(inbox.getByRole('article')).toHaveCount(10);
    const first = (await ok('GET', '/notifications?unread=true&type=APPLICATION_STATUS_CHANGED&size=10', student)).items[0];
    await context.setOffline(true);
    await page.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).first().click();
    await expect(page.getByRole('alert')).toContainText('Chưa xác nhận');
    expect((await ok('GET', '/notifications/unread-count', student)).unreadCount).toBe(unreadBefore);
    await expect(inbox.getByRole('article')).toHaveCount(10);
    await context.setOffline(false); await page.getByRole('button', { name: 'Tải lại thông báo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).first()).toBeEnabled();
    const marked = response(page, `/notifications/${first.id}/read`, 'PATCH');
    await page.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).first().evaluate(el => { el.click(); el.click(); });
    expect((await marked).status()).toBe(200);
    await expect(page.getByRole('link', { name: `Xem thông báo, ${unreadBefore - 1} chưa đọc`, exact: true })).toBeVisible();
    const next = (await ok('GET', '/notifications?unread=true&type=APPLICATION_STATUS_CHANGED&size=10', student)).items[0];
    await page.getByRole('button', { name: 'Mở', exact: true }).first().click();
    await expect(page).toHaveURL(`/candidate/applications/${next.referenceId}`);
    await expect(page.getByText(job.title, { exact: true }).first()).toBeVisible(); // Closed Job still has owned application history.
    await page.goto('/candidate/notifications');
    const all = response(page, '/notifications/read-all', 'PATCH');
    await page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true }).click();
    expect((await all).status()).toBe(200);
    await page.reload();
    await expect(page.getByRole('link', { name: 'Xem thông báo, 0 chưa đọc', exact: true })).toBeVisible();
    expect((await ok('GET', '/notifications/unread-count', student)).unreadCount).toBe(0);
    const foreign = await api('PATCH', `/notifications/${first.id}/read`, await login('studentUi'));
    expect(foreign.status).toBe(404); expect(foreign.data).toBeNull();
    evidence.cases.N04 = { generated: 12, pageSize: 10, filteredEmptyTotal: 0, filterResetsPage: true, offlineRetained: true, readOne: 200, allRead: 200, reloadUnread: 0, foreign: 404, closedJobApplicationNavigation: true };
  } finally {
    await context.setOffline(false); await ok('PUT', prefRoute, student, settingsBefore);
    if (job && (await ok('GET', `/jobs/${job.id}`, owner)).status === 'ACTIVE') await ok('PATCH', `/jobs/${job.id}/status`, owner, { status: 'CLOSED' });
  }
});

test('N05 Company inbox reads Backend filters/count and honestly represents absent producers', async ({ page }) => {
  const token = await login('companyUi'); await signIn(page, 'companyUi'); await settings(page, 'companyUi', 'notifications');
  const inbox = page.getByRole('region', { name: 'Danh sách thông báo', exact: true });
  const data = await ok('GET', '/notifications?unread=true&type=JOB_STATUS_CHANGED&page=1&size=10', token);
  await page.getByLabel('Loại thông báo', { exact: true }).selectOption('JOB_STATUS_CHANGED');
  await page.getByRole('button', { name: /^Chưa đọc/ }).click();
  await expect(inbox.getByText(`${data.totalItems} thông báo phù hợp`, { exact: true })).toBeVisible();
  expect((await api('PATCH', '/notifications/read-all', token)).status).toBe(200);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Xem thông báo, 0 chưa đọc', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true })).toBeDisabled();
  evidence.cases.N05 = { emptyInbox: true, databaseFilter: true, idempotentReadAllApi: 200, disabledFalseAction: true };
  evidence.limitations.push('Demo Company mark-one/read-all browser mutation needs owned records: no Company producer exists. Populated Company ownership/filtering is covered by PostgreSQL IT and shared UI regression, not claimed as demo browser PASS.');
});

test('N06 logout/login isolation and real invalid-session 401 recovery on secondary session', async ({ page }) => {
  await signIn(page, 'frontend'); await page.goto('/candidate/notifications');
  await expect(page.getByRole('article').first()).toBeVisible();
  await signOut(page); await signIn(page, 'studentUi'); await page.goto('/candidate/notifications');
  await expect(page.getByText('Không có thông báo phù hợp.', { exact: true })).toBeVisible();
  expect(await page.getByRole('article').count()).toBe(0);
  await settings(page, 'studentUi', 'account');
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(credentials().studentUi.email);
  await page.evaluate(() => sessionStorage.setItem('job-system:auth-token', 'invalid-secondary-session'));
  const denied = response(page, '/auth/me'); await page.reload();
  expect((await denied).status()).toBe(401); await expect(page).toHaveURL(/\/login/);
  await signIn(page, 'studentUi');
  evidence.cases.N06 = { noPreviousInbox: true, noPreviousAccountData: true, realUnauthorized: 401, relogin: true, actualClockExpiry: 'NOT_TESTED' };
});

test('N07 changed screens at 375/430/768/1024/1440 with labeled inputs, keyboard and no horizontal overflow', async ({ page }) => {
  for (const alias of ['studentUi', 'companyUi']) {
    await signIn(page, alias);
    for (const width of [375, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      for (const section of ['account', 'security', 'notifications']) {
        await settings(page, alias, section);
        await expect(page.getByRole('heading', { name: roleFor(alias) === 'candidate' ? 'Cài đặt ứng viên' : 'Cài đặt nhà tuyển dụng', exact: true })).toBeVisible();
        if (section === 'security') await expect(page.getByLabel('Mật khẩu hiện tại', { exact: true })).toBeVisible();
        else if (section === 'account') await expect(page.getByLabel(roleFor(alias) === 'candidate' ? 'Họ tên' : 'Tên công ty', { exact: true })).toBeVisible();
        else await expect(page.getByRole('switch', { name: 'Thông báo hệ thống', exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: path.join(local, `settings-${roleFor(alias)}-${section}-${width}.png`), fullPage: true });
      }
      if (alias === 'studentUi') {
        await page.goto('/candidate/notifications');
        await expect(page.getByText('Không có thông báo phù hợp.', { exact: true })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await page.screenshot({ path: path.join(local, `settings-candidate-inbox-${width}.png`), fullPage: true });
      }
    }
    if (alias === 'studentUi') {
      await page.goto('/candidate/notifications');
      await expect(page.getByRole('button', { name: 'Tải lại thông báo', exact: true })).toBeEnabled();
      await page.getByLabel('Loại thông báo', { exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Tải lại thông báo', exact: true })).toBeFocused();
    }
    await signOut(page);
  }
  evidence.cases.N07 = { widths: [375, 430, 768, 1024, 1440], screens: 7, screenshots: 35, noHorizontalOverflow: true, keyboard: true };
  expect(evidence.pageErrors).toEqual([]);
});
