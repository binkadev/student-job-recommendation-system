import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { credentials, local, login, ok, api, readLocal, writeLocal } from '../helpers.mjs';

const m = readLocal('manifest.json');
const primaryJob = m.jobs[0];
fs.mkdirSync(path.join(local, 'screenshots'), { recursive: true });
const observations = {};
let observed;

test.beforeEach(async ({ page }) => {
  observed = { pageErrors: [], networkErrors: [], failedRequests: [] };
  page.on('pageerror', error => observed.pageErrors.push(error.message));
  page.on('response', r => { if (r.status() >= 400 && new URL(r.url()).pathname.startsWith('/api')) observed.networkErrors.push({ path: new URL(r.url()).pathname, status: r.status() }); });
  page.on('requestfailed', r => observed.failedRequests.push({ path: new URL(r.url()).pathname, failure: r.failure()?.errorText }));
});
test.afterEach(async ({}, info) => {
  observations[info.title] = { status: info.status, ...observed };
  writeLocal('browser-evidence.json', observations);
});

async function signIn(page, alias = 'student') {
  const account = credentials()[alias];
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(alias.startsWith('company') ? /\/recruiter\/dashboard/ : /\/candidate\/dashboard/);
}

test('B01 public home → search → job/company details and public trace', async ({ page, context }) => {
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/jobs');
  await page.getByLabel('Từ khóa', { exact: true }).fill('Backend Java Intern [datn-e2e-v1]');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect(page.getByRole('heading', { name: primaryJob.title, exact: true })).toBeVisible();
  await page.goto(`/jobs/${primaryJob.id}`);
  await expect(page.getByRole('heading', { name: primaryJob.title, exact: true })).toBeVisible();
  await page.goto(`/companies/${m.accounts.company.companyId}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Sao Mai Technology E2E', exact: true })).toBeVisible();
  await page.screenshot({ path: path.join(local, 'screenshots/public-company.png'), fullPage: true });
  await context.tracing.stop({ path: path.join(local, 'public-trace.zip') });
  expect(observed.pageErrors).toEqual([]);
});

test('B02 Student UI login, refresh, role guard, keyboard menu and logout/login', async ({ page }) => {
  await signIn(page);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/recruiter/company');
  await expect(page).toHaveURL('/403');
  await page.goto('/candidate/dashboard');
  const menu = page.getByRole('button', { name: 'Menu tài khoản', exact: true });
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL('/login');
  expect(await page.evaluate(() => sessionStorage.getItem('job-system:auth-token') === null)).toBe(true);
  await signIn(page);
  expect(observed.pageErrors).toEqual([]);
});

test('B03 Student UI profile edit/save/reload and multiline preservation', async ({ page }) => {
  await signIn(page);
  const token = await login('student');
  const before = await ok('GET', '/students/me/profile', token);
  await page.goto('/candidate/profile/edit');
  await page.getByRole('button', { name: 'Giới thiệu', exact: true }).click();
  const summary = page.getByLabel('Giới thiệu bản thân', { exact: true });
  await expect(summary).toHaveValue(before.summary);
  const draft = `${before.summary}\nĐã kiểm chứng bằng browser E2E.`;
  await summary.fill(draft);
  const response = page.waitForResponse(r => r.url().endsWith('/api/students/me/profile') && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toBeEnabled();
  await page.reload();
  await expect(summary).toHaveValue(draft);
  expect((await ok('GET', '/students/me/profile', token)).projects).toBe(before.projects);
  await ok('PUT', '/students/me/profile', token, { summary: before.summary });
  expect(observed.pageErrors).toEqual([]);
});

test('B04 browser upload and real AI analysis using temporary secondary CV', async ({ page }) => {
  await signIn(page, 'incomplete');
  await page.goto('/candidate/cvs/upload');
  await page.getByLabel('Chọn file CV').setInputFiles(path.join(local, 'datn-e2e-v1-khoa-en.pdf'));
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/students/me/cv' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Tải lên', exact: true }).click();
  const uploaded = await (await response).json();
  expect(uploaded.success).toBe(true);
  const cvId = uploaded.data.id;
  try {
    await page.goto(`/candidate/cvs/${cvId}/analysis`);
    const analyze = page.getByRole('button', { name: /^(Phân tích|Phân tích lại)$/ }).first();
    await expect(analyze).toBeVisible();
    const parsing = page.waitForResponse(r => r.url().endsWith(`/cv/${cvId}/reanalyze`) && r.request().method() === 'POST');
    await analyze.click();
    expect((await parsing).status()).toBe(200);
    await expect(page.getByText('READY', { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByText('READY', { exact: true }).first()).toBeVisible();
  } finally {
    await ok('DELETE', `/students/me/cv/${cvId}`, await login('incomplete'));
  }
  expect(observed.pageErrors).toEqual([]);
});

test('B05 Student browser generates persisted V3 and opens evidence dialog with keyboard focus', async ({ page }) => {
  await signIn(page);
  await page.goto('/candidate/jobs/recommended');
  await page.getByLabel('CV dùng để gợi ý', { exact: true }).selectOption(String(m.cvs.student[0].id));
  await page.getByLabel('Ngưỡng xếp hạng', { exact: true }).fill('0');
  await page.getByLabel('Số kết quả tối đa', { exact: true }).fill('100');
  const response = page.waitForResponse(r => r.url().endsWith('/api/students/me/recommendations/generate') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Cập nhật gợi ý', exact: true }).click();
  const run = (await (await response).json()).data;
  expect(run.status).toBe('SUCCESS');
  await expect(page.getByText('PRIMARY', { exact: false }).first()).toBeVisible();
  const open = page.getByRole('button', { name: 'Xem phân tích', exact: true }).first();
  await open.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(open).toBeFocused();
  await page.reload();
  await expect(page.getByText(`#${run.id}`, { exact: true }).first()).toBeVisible();
  expect(observed.pageErrors).toEqual([]);
});

test('B06 browser apply → Company reads/processes → Student sees persisted status', async ({ page, browser }) => {
  const token = await login('student');
  const existing = (await ok('GET', `/students/me/applications?jobId=${primaryJob.id}`, token))[0];
  await signIn(page);
  await page.goto(`/candidate/jobs/${primaryJob.id}`);
  if (!existing || existing.status === 'REJECTED') {
    await page.getByRole('button', { name: 'Ứng tuyển', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /datn-e2e-v1-khoa-vi.docx/ }).click();
    await dialog.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await dialog.getByLabel('Nội dung thư giới thiệu').fill('Tôi là Nguyễn Minh Khoa, sinh viên tổng hợp E2E. Dự án thư viện dùng Java, Spring Boot và PostgreSQL giúp tôi thực hành REST API, phân quyền và kiểm thử. Tôi mong có cơ hội học hỏi cùng nhóm Sao Mai.');
    await dialog.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await dialog.getByLabel('Tôi xác nhận thông tin ứng tuyển là chính xác.').check();
    const response = page.waitForResponse(r => r.url().endsWith(`/api/jobs/${primaryJob.id}/apply`) && r.request().method() === 'POST');
    await dialog.getByRole('button', { name: 'Gửi ứng tuyển', exact: true }).click();
    expect((await response).status()).toBe(200);
  }
  const app = (await ok('GET', `/students/me/applications?jobId=${primaryJob.id}`, token))[0];
  const context = await browser.newContext();
  const companyPage = await context.newPage();
  await signIn(companyPage, 'company');
  await companyPage.goto(`/recruiter/candidates/${app.id}`);
  await expect(companyPage.getByText(app.coverLetter, { exact: true })).toBeVisible();
  if (app.status === 'PENDING') {
    await companyPage.getByLabel('Chuyển trạng thái', { exact: true }).selectOption('REVIEWED');
    const response = companyPage.waitForResponse(r => r.url().endsWith(`/api/applications/${app.id}/status`) && r.request().method() === 'PATCH');
    await companyPage.getByRole('button', { name: 'Cập nhật trạng thái', exact: true }).click();
    expect((await response).status()).toBe(200);
  }
  await companyPage.reload();
  await expect(companyPage.getByText('Đã xem', { exact: true }).first()).toBeVisible();
  await page.goto(`/candidate/applications/${app.id}`);
  await expect(page.getByText('Đã xem', { exact: true }).first()).toBeVisible();
  await page.reload();
  expect((await ok('GET', `/students/me/applications/${app.id}`, token)).status).toBe('REVIEWED');
  await context.close();
  expect(observed.pageErrors).toEqual([]);
});

test('B07 Company browser ranking with independent tiers/history and reload', async ({ page }) => {
  await signIn(page, 'company');
  await page.goto(`/recruiter/jobs/${m.jobs[1].id}/candidate-ranking`);
  await page.getByLabel('Ngưỡng điểm', { exact: true }).fill('0');
  await page.getByLabel('Top phù hợp tổng thể', { exact: true }).fill('1');
  await page.getByLabel('Top đối sánh kỹ năng', { exact: true }).fill('2');
  const response = page.waitForResponse(r => r.url().endsWith('/candidate-ranking-runs') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /^(Chạy lại|Chạy xếp hạng)$/ }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Phù hợp tổng thể · 1', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đối sánh kỹ năng · 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xem lịch sử', exact: true }).click();
  await expect(page.locator('#ranking-run-history')).toBeVisible();
  await page.screenshot({ path: path.join(local, 'screenshots/company-ranking.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đối sánh kỹ năng · 2', exact: true })).toBeVisible();
  expect(observed.pageErrors).toEqual([]);
});

test('B08 offline unsave must preserve previously confirmed saved state and recover', async ({ page, context }) => {
  const token = await login('student');
  const saved = await ok('GET', '/students/me/saved-jobs?size=100', token);
  if (!saved.items.some(j => j.jobId === primaryJob.id)) await ok('POST', `/students/me/saved-jobs/${primaryJob.id}`, token);
  await signIn(page);
  await page.goto(`/jobs?q=${encodeURIComponent(primaryJob.title)}`);
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: primaryJob.title, exact: true }) });
  await expect(card.getByRole('button', { name: 'Bỏ lưu việc làm', exact: true })).toBeVisible();
  await context.setOffline(true);
  try {
    await card.getByRole('button', { name: 'Bỏ lưu việc làm', exact: true }).click();
    await expect(page.getByText(/Không thể (lưu|cập nhật)/).first()).toBeVisible();
    await expect(card.getByRole('button', { name: 'Bỏ lưu việc làm', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Tải lại trạng thái', exact: true }).click();
    await expect(page.getByText('Chưa xác minh được trạng thái ứng tuyển. Hãy tải lại trước khi gửi đơn.', { exact: true })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Đã ứng tuyển', exact: true })).toBeDisabled();
  } finally {
    await context.setOffline(false);
  }
  await page.reload();
  await expect(card.getByRole('button', { name: 'Bỏ lưu việc làm', exact: true })).toBeVisible();
  expect((await ok('GET', '/students/me/saved-jobs?size=100', token)).items.some(j => j.jobId === primaryJob.id)).toBe(true);
});

for (const width of [375, 430, 768, 1024, 1440]) {
  test(`B09-${width} responsive public/Student/Company and keyboard focus`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const routes = ['/', '/jobs', '/login'];
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await signIn(page);
    for (const route of ['/candidate/profile', '/candidate/cvs', '/candidate/jobs/recommended']) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await page.screenshot({ path: path.join(local, `screenshots/student-${width}.png`), fullPage: true });
    // Clear only this browser's session, then authenticate Company through the real form.
    await page.evaluate(() => sessionStorage.clear());
    await signIn(page, 'company');
    for (const route of ['/recruiter/dashboard', '/recruiter/jobs', `/recruiter/jobs/${m.jobs[1].id}/candidate-ranking`]) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
    await page.screenshot({ path: path.join(local, `screenshots/company-${width}.png`), fullPage: true });
    expect(observed.pageErrors).toEqual([]);
  });
}

test('B10 browser Student/Company registration uses durable auxiliary aliases', async ({ page }) => {
  for (const [alias, role] of [['studentUi', 'STUDENT'], ['companyUi', 'COMPANY']]) {
    const all = credentials();
    if (!all[alias]) {
      all[alias] = { email: `datn-e2e-v1.${alias.toLowerCase()}@datn-e2e.invalid`, password: `Ui!${randomBytes(24).toString('base64url')}9a`, role, fullName: role === 'STUDENT' ? 'Đỗ Duy UI E2E' : 'Đại diện UI E2E', ...(role === 'COMPANY' ? { companyName: 'Hải Đăng UI E2E' } : {}) };
      writeLocal('credentials.json', all);
    }
    const account = all[alias];
    const prior = await api('POST', '/auth/login', null, { email: account.email, password: account.password });
    await page.goto('/');
    await page.evaluate(() => sessionStorage.clear());
    if (!prior.success) {
      await page.goto(role === 'STUDENT' ? '/register/candidate' : '/register/recruiter');
      await page.getByLabel(role === 'STUDENT' ? 'Email' : 'Email doanh nghiệp', { exact: true }).fill(account.email);
      await page.getByLabel(role === 'STUDENT' ? 'Họ và tên' : 'Tên công ty', { exact: true }).fill(role === 'STUDENT' ? account.fullName : account.companyName);
      if (role === 'COMPANY') await page.getByLabel('Tên người đại diện', { exact: true }).fill(account.fullName);
      await page.getByLabel('Mật khẩu', { exact: true }).fill(account.password);
      await page.getByLabel('Xác nhận mật khẩu', { exact: true }).fill(account.password);
      const response = page.waitForResponse(r => r.url().endsWith('/api/auth/register') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
      expect((await response).status()).toBe(201);
      await expect(page).toHaveURL('/login');
    }
    await signIn(page, alias);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Menu tài khoản', exact: true })).toBeVisible();
  }
});

test('B11 Company profile edit, save, reload and restore', async ({ page }) => {
  const token = await login('company');
  const before = await ok('GET', '/companies/me', token);
  await signIn(page, 'company');
  await page.goto('/recruiter/company/edit');
  const description = page.getByLabel('Giới thiệu công ty', { exact: true });
  await expect(description).toHaveValue(before.description);
  try {
    await description.fill(`${before.description}\nĐã kiểm chứng lưu hồ sơ qua browser.`);
    const response = page.waitForResponse(r => r.url().endsWith('/api/companies/me') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    expect((await response).status()).toBe(200);
    await page.reload();
    await expect(description).toHaveValue(`${before.description}\nĐã kiểm chứng lưu hồ sơ qua browser.`);
  } finally { await ok('PUT', '/companies/me', token, { description: before.description }); }
});

test('B12 Company browser creates/edits a durable DRAFT; no public exposure', async ({ page }) => {
  const token = await login('company');
  const title = 'Quality Engineering Intern [datn-e2e-v1-browser]';
  let job = (await ok('GET', '/jobs?keyword=datn-e2e-v1-browser&size=100', token)).items.find(j => j.title === title && j.companyId === m.accounts.company.companyId);
  await signIn(page, 'company');
  if (!job) {
    await page.goto('/recruiter/jobs/create');
    await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await page.getByLabel('Tiêu đề', { exact: true }).fill(title);
    await page.getByLabel('Địa điểm', { exact: true }).selectOption({ label: 'TP. Hồ Chí Minh' });
    await page.getByLabel('Hạn nộp', { exact: true }).fill('2027-06-30');
    await page.getByLabel('Mô tả công việc', { exact: true }).fill('Thực tập cùng nhóm chất lượng phần mềm, chuẩn bị dữ liệu kiểm thử, đọc yêu cầu, ghi lại bước tái hiện và trao đổi với lập trình viên. Tin tổng hợp cho hệ thống E2E local.');
    await page.getByLabel('Yêu cầu', { exact: true }).fill('Sinh viên CNTT, nắm Git, SQL cơ bản và cách trình bày kết quả kiểm thử. Sẵn sàng học hỏi với người hướng dẫn.');
    await page.getByLabel('Quyền lợi', { exact: true }).fill('Có mentor và buổi trao đổi kỹ thuật hàng tuần.');
    await page.getByRole('checkbox', { name: /^Git/ }).check();
    const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/jobs' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
    job = (await (await response).json()).data;
    expect(job.status).toBe('DRAFT');
    await expect(page).toHaveURL(`/recruiter/jobs/${job.id}`);
  }
  await page.goto(`/recruiter/jobs/${job.id}/edit`);
  await expect(page.getByLabel('Tiêu đề', { exact: true })).toHaveValue(title);
  await page.getByLabel('Quyền lợi', { exact: true }).fill('Có mentor, trao đổi kỹ thuật hàng tuần và hướng dẫn ghi báo cáo lỗi có thể tái hiện.');
  const response = page.waitForResponse(r => r.url().endsWith(`/api/jobs/${job.id}`) && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  expect((await response).status()).toBe(200);
  await page.reload();
  await expect(page.getByLabel('Quyền lợi', { exact: true })).toHaveValue('Có mentor, trao đổi kỹ thuật hàng tuần và hướng dẫn ghi báo cáo lỗi có thể tái hiện.');
  expect((await ok('GET', `/jobs/${job.id}`, token)).status).toBe('DRAFT');
  expect((await api('GET', `/public/jobs/${job.id}`)).status).toBe(404);
});

test('B13 CV list activation fails offline without false success or unhandled errors', async ({ page, context }) => {
  const token = await login('student');
  await ok('PATCH', `/students/me/cv/${m.cvs.student[0].id}/active`, token);
  await signIn(page);
  await page.goto('/candidate/cvs');
  const activate = page.getByRole('button', { name: 'Đặt làm CV đang dùng', exact: true });
  await expect(activate).toBeVisible();
  await context.setOffline(true);
  try {
    await activate.click();
    await expect(page.getByText('Không thể đặt CV đang dùng', { exact: true })).toBeVisible();
    expect(observed.pageErrors).toEqual([]);
  } finally { await context.setOffline(false); }
  expect((await ok('GET', '/students/me/cv/active', token)).id).toBe(m.cvs.student[0].id);
  await page.reload();
  await expect(activate).toBeVisible();
});
