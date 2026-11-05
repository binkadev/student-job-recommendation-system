import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { api, apiBase, ok, login, credentials, writeLocal, devAdmin, upload, local } from '../helpers.mjs';

// Real Backend/PostgreSQL/AI only. Dedicated secondary applicants; PRIMARY is read-only.
const runId = randomUUID().slice(0, 8), aliases = [`savedA${runId}`, `savedB${runId}`];
const endpoint = '/companies/me/saved-candidates';
const evidence = { runId, cases: {}, responses: [], pageErrors: [] };
let owner, primary, student, otherStudent, job, applications = [], admin;
const savedIds = new Set();
async function signIn(page, alias) {
  await page.goto('/login'); const account = credentials()[alias];
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/recruiter/dashboard');
}
async function signOut(page) {
  await page.getByRole('button', { name: 'Menu tài khoản', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL('/login');
}
function response(page, route, method = 'GET') {
  return page.waitForResponse(r => new URL(r.url()).pathname === `/api${route}` && r.request().method() === method);
}
async function savedFor(application = applications[0]) {
  return (await ok('GET', `${endpoint}?studentId=${application.studentId}`, owner)).items[0];
}
async function save(application = applications[0], note = null) {
  const current = await savedFor(application); if (current) return current;
  const row = await ok('POST', endpoint, owner, { applicationId: application.id, note }); savedIds.add(row.id); return row;
}
async function savedPage(page) {
  await page.goto('/recruiter/saved-candidates');
  await expect(page.getByRole('heading', { name: 'Hồ sơ đã lưu', exact: true })).toBeVisible();
  await page.getByLabel('Mã Job nguồn', { exact: true }).fill(String(job.id));
  await expect(page.getByText('1 hồ sơ đã lưu', { exact: true }).or(page.getByText('2 hồ sơ đã lưu', { exact: true }))).toBeVisible();
}
async function noteInBrowser(page, text) {
  await page.getByRole('button', { name: 'Sửa ghi chú', exact: true }).first().click();
  await page.getByLabel('Ghi chú đánh giá', { exact: true }).fill(text);
  const received = page.waitForResponse(r => /\/saved-candidates\/\d+\/note$/.test(new URL(r.url()).pathname) && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  expect((await received).status()).toBe(200); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}
test.beforeAll(async () => {
  owner = await login('companyB'); primary = await login('company'); admin = await devAdmin();
  if (!admin) throw new Error('Company candidate fixtures require existing dev Admin; no moderation bypass.');
  const accounts = credentials();
  for (const [index, alias] of aliases.entries()) {
    accounts[alias] = { email: `datn-saved-${runId}-${index}@datn-e2e.invalid`, password: `E2e!${randomBytes(24).toString('base64url')}9a`, fullName: `Saved Candidate ${index + 1} ${runId}`, role: 'STUDENT' };
    await ok('POST', '/auth/register', null, accounts[alias]);
  }
  writeLocal('credentials.json', accounts); student = await login(aliases[0]); otherStudent = await login(aliases[1]);
  const cv = await upload(student, 'datn-e2e-v1-frontend-en.docx', true);
  job = await ok('POST', '/jobs', owner, { title: `Saved candidates [${runId}]`, description: 'Synthetic recruiter candidate management journey. React TypeScript Git with mentor.', requirements: 'React Git SQL', location: 'Hà Nội', jobType: 'INTERNSHIP', workingModel: 'HYBRID', deadline: '2099-12-31', status: 'DRAFT', skills: [] });
  await ok('PATCH', `/jobs/${job.id}/status`, owner, { status: 'PENDING_APPROVAL' });
  job = await ok('PATCH', `/jobs/${job.id}/status`, admin, { status: 'ACTIVE' });
  applications.push(await ok('POST', `/jobs/${job.id}/apply`, student, { cvFileId: cv.id, coverLetter: `Saved candidate journey ${runId}` }));
  applications.push(await ok('POST', `/jobs/${job.id}/apply`, otherStudent, { coverLetter: 'Second dedicated applicant; deliberately no CV.' }));
  evidence.fixtures = { jobId: job.id, applicationIds: applications.map(row => row.id), studentIds: applications.map(row => row.studentId), cvId: cv.id };
  writeLocal(`candidates-fixtures-${runId}.json`, evidence.fixtures);
});
test.beforeEach(({ page }) => {
  page.on('pageerror', error => evidence.pageErrors.push(error.name));
  page.on('response', r => { const url = new URL(r.url()); if (url.pathname.includes('/saved-candidates')) evidence.responses.push({ path: url.pathname, method: r.request().method(), http: r.status() }); });
});
test.afterEach(() => writeLocal('candidates-browser-evidence.json', evidence));
test.afterAll(async () => {
  for (const id of savedIds) { const result = await api('DELETE', `${endpoint}/${id}`, owner); expect([200, 404]).toContain(result.status); }
  if (job) expect((await api('DELETE', `/jobs/${job.id}`, owner)).status).toBe(200); // Existing soft-close API.
  evidence.finishedAt = new Date().toISOString(); writeLocal('candidates-browser-evidence.json', evidence);
});

test('C01 PRIMARY Company selects its Job, reads its real applicant/profile/CV; foreign CV is denied', async ({ page }) => {
  const data = await ok('GET', '/companies/me/applications?size=100', primary);
  const application = data.items.find(row => row.cvFileId); expect(application).toBeTruthy();
  await signIn(page, 'company'); await page.goto('/recruiter/candidates');
  await page.getByLabel('Vị trí tuyển dụng', { exact: true }).selectOption(String(application.jobId));
  await page.goto(`/recruiter/candidates/${application.id}`);
  await expect(page.getByRole('heading', { name: application.studentName, exact: true })).toBeVisible();
  const opened = response(page, `/companies/me/applications/${application.id}/cv/file`);
  await page.getByRole('button', { name: 'Xem CV', exact: true }).click(); expect((await opened).status()).toBe(200);
  expect((await api('GET', `/companies/me/applications/${application.id}`, owner)).status).toBe(403);
  const foreign = await fetch(`${apiBase}/api/companies/me/applications/${application.id}/cv/file`, { headers: { Authorization: `Bearer ${owner}` } }); expect(foreign.status).toBe(403);
  evidence.cases.C01 = { applicationId: application.id, ownedCv: 200, foreignDetail: 403, foreignCv: 403, primaryMutations: 0 };
});

test('C02 secondary recruiter saves, notes, searches, edits, relogs, views CV and confirms unsave', async ({ page }) => {
  const application = applications[0]; await signIn(page, 'companyB');
  await page.goto(`/recruiter/candidates/${application.id}`);
  const saved = response(page, endpoint, 'POST');
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).dblclick();
  const r = await saved; expect(r.status()).toBe(200); const row = (await r.json()).data; savedIds.add(row.id);
  await expect(page.getByRole('button', { name: 'Đã lưu ứng viên', exact: true })).toBeDisabled();
  await savedPage(page); await noteInBrowser(page, `Internal review ${runId}`);
  await page.getByLabel('Tìm ứng viên đã lưu', { exact: true }).fill(`Internal review ${runId}`);
  await expect(page.getByText(`Internal review ${runId}`, { exact: true })).toBeVisible();
  await page.getByLabel('Tìm ứng viên đã lưu', { exact: true }).fill('');
  await expect(page.getByText('1 hồ sơ đã lưu', { exact: true })).toBeVisible();
  await noteInBrowser(page, `Updated review ${runId}`);
  await page.getByLabel('Tìm ứng viên đã lưu', { exact: true }).fill(`Updated review ${runId}`);
  await expect(page.getByText(`Updated review ${runId}`, { exact: true })).toBeVisible();
  await page.reload(); await page.getByLabel('Tìm ứng viên đã lưu', { exact: true }).fill(`Updated review ${runId}`);
  await expect(page.getByText(`Updated review ${runId}`, { exact: true })).toBeVisible();
  await signOut(page); await signIn(page, 'companyB'); await savedPage(page);
  await expect(page.getByText(`Updated review ${runId}`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  const cv = response(page, `/companies/me/applications/${application.id}/cv/file`);
  await page.getByRole('button', { name: 'Xem CV', exact: true }).click(); expect((await cv).status()).toBe(200);
  await savedPage(page); await page.getByRole('button', { name: 'Bỏ lưu', exact: true }).click();
  const removed = response(page, `${endpoint}/${row.id}`, 'DELETE');
  await page.getByRole('button', { name: 'Xác nhận bỏ lưu', exact: true }).dblclick(); expect((await removed).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0); await page.reload(); expect(await savedFor()).toBeUndefined();
  expect((await ok('GET', `/companies/me/applications/${application.id}`, owner)).status).toBe('PENDING');
  evidence.cases.C02 = { save: 200, notesPersistedAcrossReloadAndLogin: true, cv: 200, unsave: 200, applicationPreserved: true };
});

test('C03 real concurrent save/unsave, ownership, note conflict, validation and live application filters', async ({ page }) => {
  const application = applications[0], body = { applicationId: application.id };
  const concurrent = await Promise.all([api('POST', endpoint, owner, body), api('POST', endpoint, owner, body)]);
  expect(concurrent.map(row => row.status).sort()).toEqual([200, 409]);
  const row = concurrent.find(row => row.status === 200).data; savedIds.add(row.id);
  const path = `${endpoint}/${row.id}/note`;
  expect((await api('PATCH', path, primary, { note: 'foreign', revision: row.revision })).status).toBe(404);
  expect((await api('DELETE', `${endpoint}/${row.id}`, primary)).status).toBe(404);
  expect((await api('POST', endpoint, primary, body)).status).toBe(403);
  expect((await api('GET', endpoint, student)).status).toBe(403);
  expect((await api('POST', endpoint, student, body)).status).toBe(403);
  expect((await api('PATCH', path, student, { note: 'student', revision: 0 })).status).toBe(403);
  expect((await api('GET', endpoint)).status).toBe(401);
  expect((await api('POST', endpoint, owner, { applicationId: 9223372036854775807n.toString() })).status).toBe(404);
  expect((await api('PATCH', path, owner, { note: 'x'.repeat(2001), revision: 0 })).status).toBe(400);
  const notes = await Promise.all([api('PATCH', path, owner, { note: 'first assessment', revision: 0 }), api('PATCH', path, owner, { note: 'second assessment', revision: 0 })]);
  expect(notes.map(row => row.status).sort()).toEqual([200, 409]);
  expect((await ok('GET', `${endpoint}?studentId=${application.studentId}`, primary)).items).toHaveLength(0);
  expect((await ok('GET', `/students/me/applications/${application.id}`, student)).note).toBeUndefined();
  await ok('PATCH', `/applications/${application.id}/status`, owner, { status: 'REVIEWED' });
  await save(applications[1], 'second applicant note');
  await signIn(page, 'companyB'); await savedPage(page);
  await page.getByLabel('Trạng thái đơn nguồn', { exact: true }).selectOption('REVIEWED');
  await expect(page.getByText('1 hồ sơ đã lưu', { exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: credentials()[aliases[0]].fullName }).getByRole('cell').filter({ hasText: 'Đã xem' })).toBeVisible();
  const deletes = await Promise.all([api('DELETE', `${endpoint}/${row.id}`, owner), api('DELETE', `${endpoint}/${row.id}`, owner)]);
  expect(deletes.map(row => row.status).sort()).toEqual([200, 404]);
  try {
    const company = await ok('GET', '/companies/me', owner);
    await ok('PATCH', `/admin/companies/${company.id}/status`, admin, { status: 'BLOCKED' });
    expect((await api('GET', endpoint, owner)).status).toBe(200);
    const blockedSave = await api('POST', endpoint, owner, body); expect(blockedSave.status).toBe(200); savedIds.add(blockedSave.data.id);
    expect((await api('PATCH', `${endpoint}/${blockedSave.data.id}/note`, owner, { note: 'blocked internal assessment', revision: 0 })).status).toBe(200);
    expect((await api('DELETE', `${endpoint}/${blockedSave.data.id}`, owner)).status).toBe(200);
  } finally {
    const company = await ok('GET', '/companies/me', owner);
    await ok('PATCH', `/admin/companies/${company.id}/status`, admin, { status: 'VERIFIED' });
  }
  evidence.cases.C03 = { saves: [200, 409], notes: [200, 409], deletes: [200, 404], foreignBookmark: 404, foreignApplication: 403, student: 403, missingAuth: 401, sourceStatus: 'REVIEWED', blockedCompanyInternalOperations: 200 };
});

test('C04 offline notes/unsave/save retain confirmed state without false success', async ({ page, context }) => {
  const row = await save(applications[0], 'Confirmed offline note');
  await signIn(page, 'companyB'); await savedPage(page);
  const target = page.getByRole('row').filter({ hasText: credentials()[aliases[0]].fullName });
  await target.getByRole('button', { name: 'Sửa ghi chú', exact: true }).click();
  await page.getByLabel('Ghi chú đánh giá').fill('Unsaved offline draft');
  await context.setOffline(true);
  try {
    await page.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
    await expect(page.getByText('Chưa lưu bản nháp.', { exact: false })).toBeVisible();
    await expect(page.getByLabel('Ghi chú đánh giá')).toHaveValue('Unsaved offline draft');
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    await target.getByRole('button', { name: 'Bỏ lưu', exact: true }).click();
    await page.getByRole('button', { name: 'Xác nhận bỏ lưu', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('Chưa xác nhận được kết quả.', { exact: false })).toBeVisible();
    await expect(page.getByText('Đã bỏ lưu hồ sơ ứng viên', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  } finally { await context.setOffline(false); }
  expect((await savedFor()).note).toBe('Confirmed offline note');
  expect((await savedFor()).id).toBe(row.id);
  await ok('DELETE', `${endpoint}/${row.id}`, owner);
  await page.goto(`/recruiter/candidates/${applications[0].id}`);
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toBeEnabled();
  await context.setOffline(true);
  try {
    await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    await expect(page.getByText('Chưa xác nhận được kết quả.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đã lưu ứng viên', exact: true })).toHaveCount(0);
  } finally { await context.setOffline(false); }
  expect(await savedFor()).toBeUndefined(); evidence.cases.C04 = { offlineNotePreserved: true, offlineUnsavePreserved: true, offlineSaveAbsent: true };
});

test('C05 Backend pagination, latest search, responsive sizes and logout/account isolation', async ({ page }) => {
  await save(applications[0], `Responsive private note ${runId}`); await save(applications[1], 'Other private note');
  await signIn(page, 'companyB'); await savedPage(page);
  await page.getByLabel('Số hồ sơ mỗi trang', { exact: true }).selectOption('1');
  await expect(page.getByText('Trang 1/2', { exact: true })).toBeVisible();
  const next = page.waitForResponse(r => new URL(r.url()).pathname === `/api${endpoint}` && new URL(r.url()).searchParams.get('page') === '2');
  await page.getByRole('button', { name: 'Sau', exact: true }).click(); expect((await next).status()).toBe(200);
  await expect(page.getByText('Trang 2/2', { exact: true })).toBeVisible();
  await page.getByLabel('Tìm ứng viên đã lưu').fill('NoMatchesCandidate');
  await page.getByLabel('Tìm ứng viên đã lưu').fill(`Responsive private note ${runId}`);
  await expect(page.getByText(`Responsive private note ${runId}`, { exact: true })).toBeVisible();
  const screenshots = [];
  for (const width of [375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole('button', { name: 'Sửa ghi chú', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: path.join(local, `screenshots/saved-candidates-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Hủy', exact: true }).click(); screenshots.push(width);
  }
  await signOut(page); await signIn(page, 'company');
  await page.goto('/recruiter/saved-candidates'); await page.getByLabel('Tìm ứng viên đã lưu').fill(`Responsive private note ${runId}`);
  await expect(page.getByText('0 hồ sơ đã lưu', { exact: true })).toBeVisible();
  await expect(page.getByText(`Responsive private note ${runId}`, { exact: true })).toHaveCount(0);
  expect(evidence.pageErrors).toEqual([]);
  evidence.cases.C05 = { backendPages: [1, 2], total: 2, sizes: screenshots, accountIsolation: true, pageErrors: 0 };
});
