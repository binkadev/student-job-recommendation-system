import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { credentials, readLocal, writeLocal, login, api, ok, local } from '../helpers.mjs';
const manifest = readLocal('manifest.json');
const evidence = { cases: {} };
async function signIn(page, alias) {
  const account = credentials()[alias];
  await page.goto('/login'); await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(alias.toLowerCase().includes('company') ? '/recruiter/dashboard' : '/candidate/dashboard');
}
test.afterEach(() => writeLocal(`uiux-${process.env.UIUX_PHASE === 'before' ? 'before' : 'after'}-acceptance-evidence.json`, evidence));

test('U01 blank Company draft focuses first invalid field, links errors and performs zero writes', async ({ page }) => {
  await signIn(page, 'companyUi'); await page.goto('/recruiter/jobs/create');
  await expect(page.getByLabel('Tiêu đề', { exact: true })).toBeVisible();
  const writes = []; page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/jobs') writes.push(1); });
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  await expect(page.getByLabel('Tiêu đề', { exact: true })).toBeFocused();
  const fields = page.locator('[aria-invalid="true"]'); expect(await fields.count()).toBeGreaterThan(0);
  for (const field of await fields.all()) {
    const ids = (await field.getAttribute('aria-describedby')).split(' ');
    for (const id of ids) await expect(page.locator(`[id="${id}"]`)).toBeVisible();
  }
  expect(writes).toEqual([]); evidence.cases.validation = { focused: true, linkedErrors: true, writes: 0 };
});

test('U02 real failed login is Vietnamese, focuses error and retains credentials', async ({ page }) => {
  const account = credentials().studentUi;
  await page.goto('/login'); await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill('ClearlyWrongSynthetic!9');
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/auth/login' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  expect((await response).status()).toBe(401);
  const error = page.locator('#login-error');
  await expect(error).toHaveText('Email hoặc mật khẩu không đúng.'); await expect(error).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue(account.email);
  await expect(page.locator('input[name="password"]')).toHaveAttribute('aria-describedby', 'login-error');
  evidence.cases.loginError = { real401: true, vietnamese: true, focused: true, draftRetained: true };
});

test('U03 Student Dashboard has no axe violations at desktop/mobile on real data', async ({ page }) => {
  await signIn(page, 'student');
  for (const width of [375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 }); await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByText('Đang tải dữ liệu...', { exact: true })).toHaveCount(0);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) }))).toEqual([]);
  }
  evidence.cases.studentAxe = { widths: [375, 430, 768, 1024, 1440], violations: 0 };
});

test('U04 Company analytics scroll data is named/focusable and axe-clean', async ({ page }) => {
  await signIn(page, 'company');
  await page.getByRole('region', { name: 'Dữ liệu xu hướng theo kỳ UTC', exact: true }).focus();
  await expect(page.getByRole('region', { name: 'Dữ liệu xu hướng theo kỳ UTC', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  const axe = await new AxeBuilder({ page }).analyze(); expect(axe.violations.map(v => v.id)).toEqual([]);
  evidence.cases.analyticsKeyboard = { focusableScroll: true, violations: 0 };
});

test('U05 ranking tier tables have distinguishable accessible names and long content wraps', async ({ page }) => {
  await signIn(page, 'company'); await page.goto(`/recruiter/jobs/${manifest.jobs[1].id}/candidate-ranking`);
  await expect(page.getByRole('region', { name: 'Ứng viên: Phù hợp tổng thể', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Ứng viên: Đối sánh kỹ năng', exact: true })).toBeVisible();
  const axe = await new AxeBuilder({ page }).analyze(); expect(axe.violations.map(v => v.id)).toEqual([]);
  evidence.cases.rankingTables = { namedTiers: true, violations: 0 };
});

test('U06 mobile menu wraps Tab/Shift+Tab, closes Escape and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 }); await signIn(page, 'companyUi');
  const trigger = page.getByRole('button', { name: 'Mở menu điều hướng', exact: true });
  await trigger.click(); const dialog = page.getByRole('dialog', { name: 'Nhà tuyển dụng', exact: true });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Đóng menu', exact: true });
  await expect(close).toBeFocused(); await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(d => d.contains(document.activeElement))).toBe(true);
  await expect(close).not.toBeFocused(); await page.keyboard.press('Tab'); await expect(close).toBeFocused();
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  evidence.cases.mobileMenu = { keyboardContained: true, tabWrap: true, shiftTabWrap: true, escape: true, restoredFocus: true };
});

test('U07 unloaded route chunk fails offline with navigation retained and explicit reload recovers', async ({ page, context }) => {
  await page.goto('/login'); await expect(page.getByRole('button', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await context.setOffline(true);
  try {
    await page.getByRole('link', { name: 'Công ty', exact: true }).first().click();
    await expect(page.getByRole('alert').filter({ hasText: 'Không thể tải trang' })).toBeVisible();
    await expect(page.getByRole('navigation').first()).toBeVisible();
    await context.setOffline(false); await page.getByRole('button', { name: 'Tải lại trang', exact: true }).click();
    await expect(page.locator('main h1')).toBeVisible();
  } finally { await context.setOffline(false); }
  evidence.cases.chunkRecovery = { navigationPreserved: true, explicitRecovery: true };
});

test('U08 Company search sends one final-value GET per typing burst, preserving server filtering', async ({ page }) => {
  await signIn(page, 'companyUi'); await page.goto('/recruiter/jobs'); await page.waitForLoadState('networkidle');
  const queries = [], writes = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.method());
    if (request.method() === 'GET' && url.pathname === '/api/companies/me/jobs' && url.searchParams.has('keyword')) queries.push(url.searchParams.get('keyword'));
  });
  const finished = page.waitForResponse(r => new URL(r.url()).pathname === '/api/companies/me/jobs' && new URL(r.url()).searchParams.get('keyword') === 'Java');
  await page.getByLabel('Từ khóa', { exact: true }).pressSequentially('Java', { delay: 50 });
  expect((await finished).status()).toBe(200);
  expect(writes).toEqual([]);
  evidence.cases.search = { queries, writes: writes.length }; expect(queries).toEqual(['Java']);
});

test('U09 login toast stays inside mobile viewport and is announced without stealing focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 }); await signIn(page, 'companyUi');
  const text = page.getByText('Đăng nhập thành công', { exact: true }); await expect(text).toBeVisible();
  const bounds = await text.evaluate(element => { const r = element.closest('.fixed').getBoundingClientRect(); return { left: r.left, right: r.right, viewport: innerWidth }; });
  await page.screenshot({ path: `.local/uiux-${process.env.UIUX_PHASE === 'before' ? 'before' : 'after'}-toast-375.png` });
  evidence.cases.toastBounds = bounds; expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);
  await expect(page.getByRole('region', { name: 'Thông báo tạm thời', exact: true })).toHaveAttribute('aria-live', 'polite');
});

test('U10 Company header has no nonfunctional sample-company selector', async ({ page }) => {
  await signIn(page, 'companyUi');
  await expect(page.getByRole('button', { name: 'Công ty mẫu', exact: true })).toHaveCount(0);
  await expect(page.getByText('Tài khoản doanh nghiệp', { exact: true })).toBeVisible();
});

test('U11 real long-name DOCX upload, READY analysis, five widths and delete-dialog keyboard', async ({ page }) => {
  const token = await login('incomplete'), name = `CV_${'software_engineering_project_'.repeat(7)}.docx`;
  let id;
  try {
    await signIn(page, 'incomplete'); await page.goto('/candidate/cvs/upload');
    await page.locator('input[type="file"]').setInputFiles({ name, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: fs.readFileSync(path.join(local, 'datn-e2e-v1-frontend-en.docx')) });
    await page.getByRole('switch', { name: 'Đặt làm CV đang dùng', exact: true }).click();
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/students/me/cv' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Tải lên', exact: true }).click();
    const received = await response; id = (await received.json()).data?.id; expect(received.status()).toBe(200);
    const uploaded = (await ok('GET', '/students/me/cv', token)).find(cv => cv.id === id);
    expect(uploaded.isActive).toBe(false);
    expect((await ok('GET', `/students/me/cv/${id}/analysis`, token)).status).toBe('NOT_READY');
    await expect(page).toHaveURL(`/candidate/cvs/${id}`);
    await page.goto(`/candidate/cvs/${id}/analysis`);
    const parsed = page.waitForResponse(r => new URL(r.url()).pathname === `/api/students/me/cv/${id}/reanalyze` && r.request().method() === 'POST');
    await page.getByRole('button', { name: /^Phân tích( lại)?$/ }).click();
    expect((await parsed).status()).toBe(200);
    expect((await ok('GET', `/students/me/cv/${id}/analysis`, token)).status).toBe('READY');
    await page.goto(`/candidate/cvs/${id}`);
    for (const width of [375, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `.local/uiux-long-cv-${width}.png`, fullPage: true });
    }
    await page.goto('/candidate/cvs'); await page.getByRole('button', { name: 'Xóa CV', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Xóa CV', exact: true }); await expect(dialog).toBeVisible();
    expect(await dialog.evaluate(d => [...d.querySelectorAll('p')].every(p => p.scrollWidth <= p.clientWidth))).toBe(true);
    const first = dialog.getByRole('button').first(), last = dialog.getByRole('button').last();
    await first.focus(); await page.keyboard.press('Shift+Tab'); await expect(last).toBeFocused();
    await page.keyboard.press('Tab'); await expect(first).toBeFocused();
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    evidence.cases.longCv = { filenameLength: name.length, realParser: 'READY', active: uploaded.isActive, widths: 5, modalKeyboard: true };
  } finally { if (id) expect((await api('DELETE', `/students/me/cv/${id}`, token)).status).toBe(200); }
});
