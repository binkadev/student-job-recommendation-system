import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { credentials, login, ok, api, devAdmin, local, writeLocal } from '../helpers.mjs';

// Two existing secondary actors; terminal WITHDRAWN cannot be reset or reused.
// At most two fresh jobs per worker/run, approved via Admin APIs, soft-closed in afterAll.
const runId = randomUUID().slice(0, 8), jobs = [];
const evidence = { startedAt: new Date().toISOString(), runId, cases: {}, modes: [{ responses: [], failed: [], pageErrors: [] }] };
let studentToken, companyToken, foreignToken, adminToken, skillId, cv;
const account = 'frontend';
test.beforeAll(async () => {
  studentToken = await login(account); companyToken = await login('companyB'); foreignToken = await login('data');
  adminToken = await devAdmin(); if (!adminToken) throw new Error('Lifecycle fixtures require a real existing Admin; no moderation bypass.');
  const company = await ok('GET', '/companies/me', companyToken); expect(company.status).toBe('VERIFIED');
  const cvs = await ok('GET', '/students/me/cv', studentToken);
  for (const candidate of cvs) if ((await ok('GET', `/students/me/cv/${candidate.id}/analysis`, studentToken)).status === 'READY') { cv = candidate; break; }
  if (!cv) throw new Error('Secondary actor requires its existing READY CV; do not alter PRIMARY CVs.');
  skillId = (await ok('GET', '/skills?size=100', studentToken)).items.find(s => s.name === 'Git').id;
  evidence.fixtures = { companyId: company.id, cvId: cv.id, jobIds: [] };
});
async function createLifecycleJob(action) {
    let job = await ok('POST', '/jobs', companyToken, { title: `Lifecycle ${action} [${runId}]`, description: 'Work with React TypeScript Git and a mentor. Synthetic lifecycle fixture.', requirements: 'React TypeScript JavaScript Git.', location: 'Hà Nội', jobType: 'INTERNSHIP', workingModel: 'HYBRID', deadline: '2099-12-31', status: 'DRAFT', skills: [{ skillId, importance: 'REQUIRED' }] });
    jobs.push(job);
    await ok('PATCH', `/jobs/${job.id}/status`, companyToken, { status: 'PENDING_APPROVAL' });
    job = await ok('PATCH', `/jobs/${job.id}/status`, adminToken, { status: 'ACTIVE' });
    expect(job.companyId).toBe(evidence.fixtures.companyId);
  evidence.fixtures.jobIds = jobs.map(j => j.id);
  writeLocal(`lifecycle-fixtures-${runId}.json`, evidence.fixtures);
  return job;
}
test.afterAll(async () => {
  for (const job of jobs) {
    const result = await api('DELETE', `/jobs/${job.id}`, companyToken);
    expect(result.status).toBe(200);
    await api('DELETE', `/students/me/saved-jobs/${job.id}`, studentToken);
    expect((await ok('GET', `/jobs/${job.id}`, companyToken)).status).toBe('CLOSED');
    expect((await api('GET', `/public/jobs/${job.id}`)).status).toBe(404);
  }
  evidence.cleanup = { softClosedOnlyCreatedJobIds: jobs.map(j => j.id), cvsUntouched: true };
  writeLocal(`lifecycle-evidence-${runId}.json`, evidence); writeLocal('lifecycle-evidence.json', evidence);
});
test.afterEach(() => { writeLocal(`lifecycle-evidence-${runId}.json`, evidence); writeLocal('lifecycle-evidence.json', evidence); });
async function signIn(page, alias = account) {
  const user = credentials()[alias]; await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(alias === 'companyB' ? '/recruiter/dashboard' : '/candidate/dashboard');
}
async function signOut(page) {
  await page.getByRole('button', { name: 'Menu tài khoản', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL('/login');
}
function response(page, route, method) { return page.waitForResponse(r => new URL(r.url()).pathname === `/api${route}` && r.request().method() === method); }
async function applyInBrowser(page, job, letter) {
  await page.goto(`/candidate/jobs/${job.id}`);
  await page.getByRole('button', { name: /^(Ứng tuyển|Ứng tuyển lại)$/ }).click();
  return finishApply(page, job, letter);
}
async function finishApply(page, job, letter) {
  const modal = page.getByRole('dialog');
  await modal.getByRole('button').filter({ has: page.getByText(cv.originalFileName, { exact: true }) }).click();
  await modal.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await modal.getByLabel('Nội dung thư giới thiệu').fill(letter);
  await modal.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  await modal.getByRole('checkbox', { name: 'Tôi xác nhận thông tin ứng tuyển là chính xác.' }).check();
  const submitted = response(page, `/jobs/${job.id}/apply`, 'POST');
  await modal.getByRole('button', { name: 'Gửi ứng tuyển', exact: true }).dblclick();
  const result = await submitted; expect(result.status()).toBe(200); const body = await result.json();
  expect(body.data.status).toBe('PENDING'); expect(body.data.cvFileId).toBe(cv.id); expect(body.data.coverLetter).toBe(letter);
  await expect(modal.getByRole('heading', { name: 'Ứng tuyển thành công', exact: true })).toBeVisible();
  return body.data;
}
function instrumentCompany(page) {
  const pending = [], record = evidence.modes[0];
  page.on('pageerror', error => record.pageErrors.push({ name: error.name }));
  page.on('requestfailed', r => record.failed.push({ path: new URL(r.url()).pathname, error: r.failure()?.errorText }));
  page.on('response', r => {
    const pathname = new URL(r.url()).pathname;
    if (!/^\/api\/companies\/me\/applications\/\d+$/.test(pathname)) return;
    pending.push((async () => {
      const row = { path: pathname, http: r.status(), requestId: r.headers()['x-request-id'] };
      try { const b = await r.json(); row.body = { success: b.success, applicationId: b.data?.id, status: b.data?.status, dataKeys: Object.keys(b.data ?? {}) }; } catch { row.bodyUnreadable = true; }
      record.responses.push(row);
    })());
  });
  return async () => Promise.all(pending);
}
async function companyDetail(page, app, expected, reload = false) {
  const received = response(page, `/companies/me/applications/${app.id}`, 'GET');
  if (reload) await page.reload(); else await page.goto(`/recruiter/candidates/${app.id}`);
  const r = await received; expect(r.status()).toBe(200); const b = await r.json(); expect(b.data.status).toBe(expected);
  const label = { PENDING: 'Chờ xử lý', REVIEWED: 'Đã xem', REJECTED: 'Từ chối', WITHDRAWN: 'Ứng viên rút đơn' }[expected];
  await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
}
async function noOverflow(page, label, width) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: path.join(local, `screenshots/lifecycle-${label}-${width}.png`), fullPage: true });
}

test('L01 real Student withdraws PENDING with cancel/offline/recovery; Company sees terminal WITHDRAWN', async ({ page, context, browser }) => {
  const withdrawJob = await createLifecycleJob('Withdraw');
  const companyContext = await browser.newContext(); const companyPage = await companyContext.newPage(); const flush = instrumentCompany(companyPage);
  try {
    await signIn(page); const app = await applyInBrowser(page, withdrawJob, 'First secondary withdrawal letter.');
    await signIn(companyPage, 'companyB'); await companyDetail(companyPage, app, 'PENDING');
    for (const width of [375, 430, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [surface, route] of [['list', '/candidate/applications'], ['detail', `/candidate/applications/${app.id}`], ['status', `/candidate/applications/${app.id}/status`]]) {
        await page.goto(route);
        if (surface === 'list') await page.getByLabel('Từ khóa', { exact: true }).fill(withdrawJob.title);
        await expect(page.getByRole('button', { name: 'Rút đơn ứng tuyển', exact: true })).toBeVisible();
        await noOverflow(page, surface, width);
      }
      await page.getByRole('button', { name: 'Rút đơn ứng tuyển', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Rút đơn ứng tuyển', exact: true });
      await expect(dialog.getByText('Đơn đã rút sẽ không thể ứng tuyển lại vào cùng vị trí theo chính sách hiện tại.')).toBeVisible();
      await noOverflow(page, 'withdraw-dialog', width);
      await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Rút đơn ứng tuyển', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Rút đơn ứng tuyển', exact: true });
    await context.setOffline(true);
    try {
      await dialog.getByRole('button', { name: 'Xác nhận rút đơn', exact: true }).click();
      await expect(dialog.getByRole('alert')).toBeVisible();
      expect((await ok('GET', `/students/me/applications/${app.id}`, studentToken)).status).toBe('PENDING');
    } finally { await context.setOffline(false); }
    const refreshed = response(page, `/students/me/applications/${app.id}`, 'GET');
    await dialog.getByRole('button', { name: 'Tải lại trạng thái', exact: true }).click(); expect((await refreshed).status()).toBe(200);
    const patched = response(page, `/applications/${app.id}/status`, 'PATCH');
    let successful = 0; page.on('response', r => { if (new URL(r.url()).pathname === `/api/applications/${app.id}/status` && r.request().method() === 'PATCH' && r.status() === 200) successful++; });
    await dialog.getByRole('button', { name: 'Xác nhận rút đơn', exact: true }).dblclick(); expect((await patched).status()).toBe(200);
    await expect(dialog).not.toBeVisible(); expect(successful).toBe(1);
    await page.reload(); await expect(page.getByText('Đã rút', { exact: true }).last()).toBeVisible();
    await companyDetail(companyPage, app, 'WITHDRAWN', true);
    await expect(companyPage.getByRole('button', { name: 'Cập nhật trạng thái', exact: true })).toBeDisabled();
    const checks = [
      ['foreign Student', foreignToken, 'WITHDRAWN', 403], ['Student', studentToken, 'ACCEPTED', 403],
      ['duplicate withdrawal', studentToken, 'WITHDRAWN', 400], ['Company review', companyToken, 'REVIEWED', 400], ['Company accept', companyToken, 'ACCEPTED', 400],
    ];
    const roles = [];
    for (const check of checks) {
      const result = await api('PATCH', `/applications/${app.id}/status`, check[1], { status: check[2] });
      roles.push({ role: check[0], target: check[2], expected: check[3], actual: result.status }); expect(result.status).toBe(check[3]);
    }
    expect((await api('POST', `/jobs/${withdrawJob.id}/apply`, studentToken, { cvFileId: cv.id })).status).toBe(400);
    await page.goto(`/candidate/jobs/${withdrawJob.id}`);
    await expect(page.getByRole('button', { name: 'Không thể ứng tuyển', exact: true })).toBeDisabled();
    await expect(page.getByText('Đơn đã rút sẽ không thể ứng tuyển lại vào cùng vị trí theo chính sách hiện tại.')).toBeVisible();
    evidence.cases.L01 = { applicationId: app.id, status: (await ok('GET', `/students/me/applications/${app.id}`, studentToken)).status, successfulWithdrawals: successful, offlinePreservedPending: true, roles, responsiveWidths: [375, 430, 768, 1024, 1440] };
  } finally { await flush(); await companyContext.close(); }
});

test('L02 real stale withdrawal reconciles review; rejected history reapplies through READY CV, entry points and one new PENDING row', async ({ page, context, browser }) => {
  const reapplyJob = await createLifecycleJob('Reapply');
  const companyContext = await browser.newContext(); const companyPage = await companyContext.newPage(); const flush = instrumentCompany(companyPage);
  let watcher;
  try {
    await signIn(page); const first = await applyInBrowser(page, reapplyJob, 'Original secondary rejected letter.');
    await signIn(companyPage, 'companyB'); await companyDetail(companyPage, first, 'PENDING');
    await page.goto(`/candidate/applications/${first.id}`); await page.getByRole('button', { name: 'Rút đơn ứng tuyển', exact: true }).click();
    await ok('PATCH', `/applications/${first.id}/status`, companyToken, { status: 'REVIEWED' });
    const denied = response(page, `/applications/${first.id}/status`, 'PATCH');
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận rút đơn', exact: true }).click(); expect((await denied).status()).toBe(400);
    await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(page.getByText('Đã xem', { exact: true }).last()).toBeVisible();
    await companyDetail(companyPage, first, 'REVIEWED', true);
    await companyPage.getByLabel('Chuyển trạng thái', { exact: true }).selectOption('REJECTED');
    const rejected = response(companyPage, `/applications/${first.id}/status`, 'PATCH');
    await companyPage.getByRole('button', { name: 'Cập nhật trạng thái', exact: true }).click(); expect((await rejected).status()).toBe(200);
    await expect(companyPage.getByText('Từ chối', { exact: true }).first()).toBeVisible();
    await ok('POST', `/students/me/saved-jobs/${reapplyJob.id}`, studentToken);
    for (const route of ['/candidate/jobs', '/candidate/jobs/saved']) {
      await page.goto(route); if (route === '/candidate/jobs') await page.getByLabel('Từ khóa', { exact: true }).fill(reapplyJob.title);
      const popupPromise = page.waitForEvent('popup'); await page.getByRole('link', { name: 'Ứng tuyển lại', exact: true }).click();
      const popup = await popupPromise; await expect(popup.getByRole('button', { name: 'Ứng tuyển lại', exact: true })).toBeEnabled(); await popup.close();
    }
    await page.goto(`/candidate/applications/${first.id}`); await page.getByRole('link', { name: 'Xem việc làm', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ứng tuyển lại', exact: true })).toBeEnabled();
    await page.goto(`/jobs/${reapplyJob.id}`); await expect(page.getByRole('button', { name: 'Ứng tuyển lại', exact: true }).first()).toBeEnabled();
    await ok('POST', '/students/me/recommendations/generate', studentToken, { cvId: cv.id, threshold: 0, limit: 100 });
    await page.goto('/candidate/jobs/recommended'); await page.getByLabel('Địa điểm', { exact: true }).selectOption({ label: 'Hà Nội' });
    const card = page.locator('section').filter({ has: page.getByRole('link', { name: reapplyJob.title, exact: true }) }).filter({ has: page.getByRole('button', { name: 'Ứng tuyển lại', exact: true }) });
    await card.getByRole('button', { name: 'Ứng tuyển lại', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: `Ứng tuyển lại ${reapplyJob.title}`, exact: true })).toBeVisible();
    for (const width of [375, 430, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 1000 }); await noOverflow(page, 'reapply-modal', width); }
    watcher = await context.newPage(); await signIn(watcher); await watcher.goto(`/candidate/jobs/${reapplyJob.id}`);
    await expect(watcher.getByRole('button', { name: 'Ứng tuyển lại', exact: true })).toBeEnabled();
    let posts = 0; page.on('request', r => { if (new URL(r.url()).pathname === `/api/jobs/${reapplyJob.id}/apply` && r.method() === 'POST') posts++; });
    const second = await finishApply(page, reapplyJob, 'A new READY CV cover letter after rejection.'); expect(posts).toBe(1); expect(second.id).not.toBe(first.id);
    await expect(watcher.getByRole('button', { name: 'Đã ứng tuyển', exact: true })).toBeDisabled();
    await expect(watcher.getByRole('link', { name: 'Xem đơn gần nhất', exact: true })).toHaveAttribute('href', `/candidate/applications/${second.id}`);
    const history = await ok('GET', `/students/me/applications?jobId=${reapplyJob.id}`, studentToken);
    expect(history).toHaveLength(2); expect(history[0].id).toBe(second.id); expect(history[0].status).toBe('PENDING');
    expect(history[1].id).toBe(first.id); expect(history[1].status).toBe('REJECTED'); expect(history[1].coverLetter).toBe('Original secondary rejected letter.');
    expect((await api('POST', `/jobs/${reapplyJob.id}/apply`, studentToken, { cvFileId: cv.id, coverLetter: 'duplicate' })).status).toBe(409);
    const companyHistory = await ok('GET', `/companies/me/jobs/${reapplyJob.id}/applications`, companyToken);
    expect(companyHistory.map(a => a.id).sort()).toEqual([first.id, second.id].sort());
    await companyDetail(companyPage, second, 'PENDING');
    await page.goto(`/candidate/jobs/${reapplyJob.id}`); await expect(page.getByRole('button', { name: 'Đã ứng tuyển', exact: true })).toBeDisabled();
    await page.reload(); await expect(page.getByRole('link', { name: 'Xem đơn gần nhất', exact: true })).toHaveAttribute('href', `/candidate/applications/${second.id}`);
    await signOut(page); await signIn(page, 'data'); await page.goto(`/candidate/jobs/${reapplyJob.id}`);
    await expect(page.getByRole('button', { name: 'Ứng tuyển', exact: true })).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Xem đơn gần nhất', exact: true })).toHaveCount(0);
    await signOut(page); await signIn(page); await page.goto(`/candidate/jobs/${reapplyJob.id}`);
    await expect(page.getByRole('button', { name: 'Đã ứng tuyển', exact: true })).toBeDisabled();
    // Existing terminal history also enforces eligibility when the owned fixture is closed.
    await ok('DELETE', `/jobs/${reapplyJob.id}`, companyToken);
    expect((await api('POST', `/jobs/${reapplyJob.id}/apply`, studentToken, { cvFileId: cv.id })).status).toBe(400);
    evidence.cases.L02 = { oldApplicationId: first.id, newApplicationId: second.id, oldStatus: history[1].status, latestStatus: history[0].status, historyCount: history.length, duplicateHttp: 409, raceHttp: 400, browserPosts: posts, readyCvId: cv.id, crossTabReadBack: true, logoutLoginIsolated: true, surfaces: ['public', 'candidate list/detail', 'saved', 'application link', 'recommended', 'modal'] };
    expect(evidence.modes[0].pageErrors).toEqual([]);
  } finally { await flush(); await watcher?.close(); await companyContext.close(); }
});
