import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// This suite never imports dataset/helpers or reads manual demo credentials.
const fixturePath = process.env.RECRUITING_WORKFLOWS_FIXTURE;
if (!fixturePath) throw new Error('Dedicated recruiting runner required');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(fixture.backendUrl)) throw new Error('Disposable loopback Backend required');
const local = path.dirname(fixturePath), ids = fixture.ids, tokens = new Map();
const statePath = path.join(local, 'scenario-state.json'), evidencePath = path.join(local, 'evidence.json');
const readState = () => fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
function saveState(values) { fs.writeFileSync(statePath, JSON.stringify({ ...readState(), ...values }, null, 2)); }
function required(name) { const value = readState()[name]; if (!value) throw new Error(`Missing preceding scenario artifact: ${name}`); return value; }
let protocol = [], resourceFailures = [];
function record(method, route, status, body) {
  if (!/\/(interviews|invitations|applications|saved-candidates)/.test(route)) return;
  // Evidence deliberately excludes headers, tokens, credentials, titles, notes and messages.
  protocol.push({ method, path: route, status, ...(body?.expectedStatus ? { expectedStatus: body.expectedStatus, targetStatus: body.status } : {}) });
}
test.beforeEach(async ({ page }) => {
  protocol = []; resourceFailures = [];
  page.on('requestfailed', r => { const url = new URL(r.url()); if (!url.pathname.startsWith('/api/')) resourceFailures.push({ path: url.pathname, failure: r.failure()?.errorText }); });
  page.on('response', response => {
    const request = response.request(), url = new URL(response.url());
    if (!url.pathname.startsWith('/api/')) { if (response.status() >= 400) resourceFailures.push({ path: url.pathname, status: response.status() }); return; }
    let body; try { body = request.postDataJSON(); } catch { /* GET/binary requests have no JSON body. */ }
    record(request.method(), url.pathname, response.status(), body);
  });
});
test.afterEach(async ({}, info) => {
  const evidence = fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, 'utf8')) : { realFrontend: true, realBackend: true, postgres: '17', mocks: false, cases: {} };
  evidence.cases[info.title] = { result: info.status, expected: info.expectedStatus, durationMs: info.duration, protocol, resourceFailures };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
});
async function api(request, alias, route, options = {}) {
  if (alias && !tokens.has(alias)) {
    const { email, password } = fixture.accounts[alias];
    const login = await request.post(`${fixture.backendUrl}/api/auth/login`, { data: { email, password } });
    if (login.status() !== 200) throw new Error(`Synthetic ${alias} login failed`);
    const token = (await login.json()).data?.token; if (!token) throw new Error('Synthetic login token missing'); tokens.set(alias, token);
  }
  const response = await request.fetch(`${fixture.backendUrl}/api${route}`, { ...options, headers: { ...(alias ? { Authorization: `Bearer ${tokens.get(alias)}` } : {}), ...options.headers } });
  record(options.method ?? 'GET', `/api${route}`, response.status(), options.data);
  return response;
}
async function data(request, alias, route, options) {
  const response = await api(request, alias, route, options); expect(response.status()).toBe(200);
  const body = await response.json(); expect(body.success).toBe(true); return body.data;
}
async function all(request, alias, feature) {
  const prefix = alias.toLowerCase().includes('company') ? 'companies' : 'students';
  const rows = [];
  for (let page = 1; ; page++) {
    const result = await data(request, alias, `/${prefix}/me/${feature}?page=${page}&size=100`);
    rows.push(...result.items); if (page >= result.totalPages) return rows;
  }
}
async function control(action) {
  const id = randomUUID(), command = path.join(local, 'control.json'), reply = path.join(local, `reply-${id}.json`);
  fs.writeFileSync(command + '.tmp', JSON.stringify({ id, action })); fs.renameSync(command + '.tmp', command);
  await expect.poll(() => fs.existsSync(reply), { timeout: 12_000, intervals: [50, 100, 200] }).toBe(true);
  return JSON.parse(fs.readFileSync(reply, 'utf8'));
}
async function database() { const result = await control('snapshot'); expect(result.applicationDigest).toBe(fixture.initialDatabase.applicationDigest); expect(result.applicationCount).toBe(2); return result; }
function sqlRow(snapshot, table, id) { const row = snapshot[table].find(item => item.id === id); expect(row).toBeDefined(); return row; }
async function signIn(page, alias = 'company') {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(fixture.accounts[alias].email);
  await page.locator('input[name="password"]').fill(fixture.accounts[alias].password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const role = alias === 'admin' ? 'admin' : alias.toLowerCase().includes('company') ? 'recruiter' : 'candidate';
  await expect(page).toHaveURL(`/${role}/dashboard`);
}
async function logout(page) {
  await page.getByRole('button', { name: 'Menu tài khoản', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL('/login');
}
function responseFor(page, route, method = 'GET') { return page.waitForResponse(r => new URL(r.url()).pathname === `/api${route}` && r.request().method() === method); }
async function schedule(page, title) {
  await page.goto('/recruiter/interviews/create');
  await expect(page.getByRole('option', { name: new RegExp(`#${ids.application} ·`) })).toBeAttached();
  await page.getByLabel('Đơn ứng tuyển', { exact: true }).selectOption(String(ids.application));
  await page.getByLabel('Tiêu đề phỏng vấn', { exact: true }).fill(title);
  await page.getByLabel('Ngày giờ phỏng vấn (giờ máy chủ)', { exact: true }).fill(fixture.futureAt);
  await page.getByLabel('Thời lượng (phút)', { exact: true }).fill('60');
  await page.getByLabel('Liên kết cuộc họp', { exact: true }).fill('https://meet.example.test/synthetic');
  await page.getByLabel('Ghi chú phỏng vấn', { exact: true }).fill('Synthetic interview notes');
  const inputTime = await page.getByLabel('Ngày giờ phỏng vấn (giờ máy chủ)', { exact: true }).inputValue();
  const pending = responseFor(page, '/companies/me/interviews', 'POST');
  await page.getByRole('button', { name: 'Lưu lịch phỏng vấn', exact: true }).click();
  const response = await pending; expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({ applicationId: ids.application, title, scheduledAt: inputTime, durationMinutes: 60, meetingType: 'ONLINE', locationOrLink: 'https://meet.example.test/synthetic', notes: 'Synthetic interview notes' });
  expect(inputTime).not.toMatch(/Z|[+-]\d{2}:\d{2}$/);
  const saved = (await response.json()).data;
  await expect(page).toHaveURL(`/recruiter/interviews/${saved.id}`); await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  return saved;
}
async function action(page, name, route, expectedStatus, status) {
  await page.getByRole('button', { name, exact: true }).click();
  const modal = page.getByRole('dialog'); await expect(modal).toBeVisible();
  const pending = responseFor(page, route, 'PATCH');
  await modal.getByRole('button', { name: 'Xác nhận thực hiện', exact: true }).click();
  const response = await pending;
  expect(response.request().postDataJSON()).toEqual({ expectedStatus, status });
  return response;
}
async function inviteFromSource(page, source, jobKey, message) {
  await page.goto(source === 'saved' ? '/recruiter/saved-candidates' : `/recruiter/candidates/${ids.application}`);
  await expect(page.getByRole('link', { name: 'Mời ứng tuyển', exact: true })).toBeVisible();
  const sourceResponse = responseFor(page, `/companies/me/applications/${ids.application}`);
  await page.getByRole('link', { name: 'Mời ứng tuyển', exact: true }).click();
  expect((await sourceResponse).status()).toBe(200);
  await expect(page).toHaveURL(`/recruiter/invitations/create?applicationId=${ids.application}`);
  await expect(page.getByText(`Đơn nguồn #${ids.application}`, { exact: false })).toBeVisible();
  await expect(page.getByRole('option', { name: new RegExp(`#${ids[jobKey]} ·`) })).toBeAttached();
  await page.getByLabel('Công việc mời ứng tuyển', { exact: true }).selectOption(String(ids[jobKey]));
  await page.getByLabel('Lời nhắn mời ứng tuyển (không bắt buộc)', { exact: true }).fill(message);
  const pending = responseFor(page, '/companies/me/invitations', 'POST');
  await page.getByRole('button', { name: 'Gửi lời mời ứng tuyển', exact: true }).click();
  const response = await pending;
  expect(response.request().postDataJSON()).toEqual({ studentId: ids.student, jobId: ids[jobKey], message });
  return response;
}

test('E01 Company creates and persists an ONLINE interview through real UI', async ({ page, request }) => {
  expect(fixture.activeProfiles).toEqual(['integration']); expect(fixture.initialDatabase.fixtureCounts).toEqual({ users: 5, companies: 2, students: 2, jobs: 6, savedCandidates: 1 });
  expect(fixture.hibernateSchemaValidation).toBe(true); expect(fixture.initialDatabase.postgresMajor).toBe(17);
  expect(fixture.initialDatabase.migrationVersions).toEqual(Array.from({ length: 25 }, (_, index) => String(index + 1)));
  await signIn(page); const saved = await schedule(page, 'E01 scheduled interview'); saveState({ interviewId: saved.id });
  expect(saved.companyId).toBe(ids.company); expect(saved.studentId).toBe(ids.student); expect(saved.applicationId).toBe(ids.application);
  expect((await all(request, 'company', 'interviews')).find(row => row.id === saved.id).scheduledAt.slice(0,16)).toBe(fixture.futureAt.slice(0,16));
  await page.reload(); await expect(page.getByRole('heading', { name: 'E01 scheduled interview', exact: true })).toBeVisible();
  await expect(page.getByText('Synthetic interview notes', { exact: true })).toBeVisible();
  expect(sqlRow(await database(), 'interviews', saved.id).status).toBe('SCHEDULED');
});

test('E02 Student confirms SCHEDULED interview with captured expectedStatus', async ({ page, request }) => {
  const id = required('interviewId'); await signIn(page, 'student'); await page.goto('/candidate/interviews');
  await page.getByRole('link', { name: `Chi tiết #${id}`, exact: true }).click();
  const response = await action(page, 'Xác nhận tham dự', `/students/me/interviews/${id}/respond`, 'SCHEDULED', 'CONFIRMED');
  expect(response.status()).toBe(200); await expect(page.getByRole('dialog')).toHaveCount(0);
  for (const alias of ['company', 'student']) expect((await all(request, alias, 'interviews')).find(row => row.id === id).status).toBe('CONFIRMED');
  expect(sqlRow(await database(), 'interviews', id).status).toBe('CONFIRMED');
});

test('E03 Company cancels a separate interview and completes valid historical CONFIRMED', async ({ page, request }) => {
  await signIn(page); const cancelled = await schedule(page, 'E03 cancellation interview'); saveState({ cancelledInterviewId: cancelled.id });
  expect((await action(page, 'Hủy', `/companies/me/interviews/${cancelled.id}/status`, 'SCHEDULED', 'CANCELLED')).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Hủy', exact: true })).toHaveCount(0);
  await page.goto(`/recruiter/interviews/${ids.historicalConfirmed}`);
  expect((await action(page, 'Đánh dấu hoàn tất', `/companies/me/interviews/${ids.historicalConfirmed}/status`, 'CONFIRMED', 'COMPLETED')).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByRole('button', { name: 'Đánh dấu hoàn tất', exact: true })).toHaveCount(0);
  expect((await api(request, 'student', `/students/me/interviews/${cancelled.id}/respond`, { method: 'PATCH', data: { expectedStatus: 'CANCELLED', status: 'CONFIRMED' } })).status()).toBe(400);
  await logout(page); await signIn(page, 'student'); await page.goto(`/candidate/interviews/${cancelled.id}`);
  await expect(page.getByText('Đã hủy', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Xác nhận tham dự' })).toHaveCount(0);
  const snapshot = await database(); expect(sqlRow(snapshot, 'interviews', cancelled.id).status).toBe('CANCELLED'); expect(sqlRow(snapshot, 'interviews', ids.historicalConfirmed).status).toBe('COMPLETED');
});

test('E04 Invitation launcher resolves the authorized applicant and preserves Application', async ({ page, request }) => {
  await signIn(page); const response = await inviteFromSource(page, 'applicant', 'applicantJob', 'E04 synthetic applicant invitation');
  expect(response.status()).toBe(200); const saved = (await response.json()).data; saveState({ applicantInvitationId: saved.id });
  expect(saved.status).toBe('PENDING'); await expect(page.getByText('Đã gửi lời mời ứng tuyển.', { exact: true })).toBeVisible();
  expect((await data(request, 'company', `/companies/me/applications/${ids.application}`)).status).toBe('REVIEWED');
  expect(sqlRow(await database(), 'invitations', saved.id).status).toBe('PENDING');
});

test('E05 Saved candidate launcher uses the real owned source and persists a separate invitation', async ({ page, request }) => {
  await signIn(page); const response = await inviteFromSource(page, 'saved', 'savedJob', 'E05 synthetic saved invitation');
  expect(response.status()).toBe(200); const saved = (await response.json()).data; saveState({ savedInvitationId: saved.id });
  await page.getByRole('link', { name: 'Xem lời mời đã gửi', exact: true }).click();
  await expect(page.getByRole('link', { name: `Chi tiết #${saved.id}`, exact: true })).toBeVisible();
  expect((await all(request, 'company', 'invitations')).find(row => row.id === saved.id).jobId).toBe(ids.savedJob);
  expect(sqlRow(await database(), 'invitations', saved.id).status).toBe('PENDING');
});


test('E06 Student accepts and declines invitations without creating/changing Applications', async ({ page, request }) => {
  await signIn(page, 'student'); await page.goto('/candidate/invitations');
  const accepted = required('applicantInvitationId'), declined = required('savedInvitationId');
  await page.getByRole('link', { name: `Chi tiết #${accepted}`, exact: true }).click();
  await expect(page.getByText('E04 synthetic applicant invitation', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem công việc và ứng tuyển', exact: true })).toHaveAttribute('href', `/candidate/jobs/${ids.applicantJob}`);
  expect((await action(page, 'Chấp nhận lời mời', `/students/me/invitations/${accepted}/respond`, 'PENDING', 'ACCEPTED')).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0); await page.reload(); await expect(page.getByText('Đã chấp nhận', { exact: true })).toBeVisible();
  await page.goto(`/candidate/invitations/${declined}`); await expect(page.getByText('E05 synthetic saved invitation', { exact: true })).toBeVisible();
  expect((await action(page, 'Từ chối', `/students/me/invitations/${declined}/respond`, 'PENDING', 'DECLINED')).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Xem công việc và ứng tuyển', exact: true }).click();
  await expect(page).toHaveURL(`/candidate/jobs/${ids.savedJob}`);
  const list = await all(request, 'student', 'invitations');
  expect(list.find(row => row.id === accepted).status).toBe('ACCEPTED'); expect(list.find(row => row.id === declined).status).toBe('DECLINED');
  const snapshot = await database(); expect(sqlRow(snapshot, 'invitations', accepted).status).toBe('ACCEPTED'); expect(sqlRow(snapshot, 'invitations', declined).status).toBe('DECLINED');
});

test('E07 Real duplicate invitation returns 409 and retains the draft without retry', async ({ page, request }) => {
  const original = await data(request, 'company', '/companies/me/invitations', { method: 'POST', data: { studentId: ids.student, jobId: ids.duplicateJob, message: 'Original pending synthetic invitation' } });
  await signIn(page); let posts = 0;
  page.on('request', r => { if (new URL(r.url()).pathname === '/api/companies/me/invitations' && r.method() === 'POST') posts++; });
  const response = await inviteFromSource(page, 'applicant', 'duplicateJob', 'E07 retained draft');
  expect(response.status()).toBe(409); expect((await response.json()).errorCode).toBe('INVITATION_ALREADY_PENDING');
  await expect(page.getByRole('alert')).toContainText('Đã có lời mời đang chờ');
  await expect(page.getByLabel('Lời nhắn mời ứng tuyển (không bắt buộc)', { exact: true })).toHaveValue('E07 retained draft');
  await expect(page.getByLabel('Công việc mời ứng tuyển', { exact: true })).toHaveValue(String(ids.duplicateJob));
  await expect(page.getByRole('button', { name: 'Gửi lời mời ứng tuyển', exact: true })).toBeDisabled();
  await page.waitForTimeout(1000); expect(posts).toBe(1);
  const matching = (await all(request, 'company', 'invitations')).filter(row => row.jobId === ids.duplicateJob && row.studentId === ids.student && row.status === 'PENDING');
  expect(matching.map(row => row.id)).toEqual([original.id]);
  expect((await database()).invitations.filter(row => row.company_id === ids.company && row.student_id === ids.student && row.job_id === ids.duplicateJob && row.status === 'PENDING')).toHaveLength(1);
});

test('E08 Stale browser status gets real 409 and only manual reload replaces confirmed data', async ({ page, request }) => {
  const invitation = await data(request, 'company', '/companies/me/invitations', { method: 'POST', data: { studentId: ids.student, jobId: ids.conflictJob, message: 'E08 synthetic conflict invitation' } });
  await signIn(page, 'student'); await page.goto(`/candidate/invitations/${invitation.id}`);
  await expect(page.getByText('Chờ phản hồi', { exact: true })).toBeVisible();
  let writes = 0, reads = 0;
  page.on('request', r => { const path = new URL(r.url()).pathname; if (path === `/api/students/me/invitations/${invitation.id}/respond` && r.method() === 'PATCH') writes++; if (path === '/api/students/me/invitations') reads++; });
  const changed = await data(request, 'company', `/companies/me/invitations/${invitation.id}/status`, { method: 'PATCH', data: { expectedStatus: 'PENDING', status: 'CANCELLED' } });
  expect(changed.status).toBe('CANCELLED');
  const response = await action(page, 'Chấp nhận lời mời', `/students/me/invitations/${invitation.id}/respond`, 'PENDING', 'ACCEPTED');
  expect(response.status()).toBe(409); expect((await response.json()).errorCode).toBe('RECRUITMENT_STATE_CONFLICT');
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Trạng thái đã thay đổi');
  await expect(page.getByText('Chờ phản hồi', { exact: true }).first()).toBeVisible(); await expect(page.getByText('Đã hủy', { exact: true })).toHaveCount(0);
  await page.waitForTimeout(1000); expect(writes).toBe(1); expect(reads).toBe(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Tải lại trạng thái', exact: true }).click();
  await expect(page.getByText('Đã hủy', { exact: true })).toBeVisible(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Chấp nhận lời mời', exact: true })).toHaveCount(0); expect(writes).toBe(1); expect(reads).toBeGreaterThan(0);
  expect(sqlRow(await database(), 'invitations', invitation.id).status).toBe('CANCELLED');
});

test('E09 Ownership/RBAC and real delayed-query account switching preserve private data', async ({ page, request }) => {
  const ownerInterview = required('interviewId'), ownerInvitation = required('applicantInvitationId');
  for (const route of ['/companies/me/interviews', '/companies/me/invitations', '/students/me/interviews', '/students/me/invitations'])
    expect((await api(request, null, route)).status()).toBe(401);
  expect((await api(request, 'otherCompany', `/companies/me/interviews/${ownerInterview}/status`, { method: 'PATCH', data: { expectedStatus: 'CONFIRMED', status: 'CANCELLED' } })).status()).toBe(403);
  expect((await api(request, 'otherStudent', `/students/me/interviews/${ownerInterview}/respond`, { method: 'PATCH', data: { expectedStatus: 'CONFIRMED', status: 'DECLINED' } })).status()).toBe(403);
  expect((await api(request, 'otherCompany', `/companies/me/invitations/${ownerInvitation}/status`, { method: 'PATCH', data: { expectedStatus: 'ACCEPTED', status: 'CANCELLED' } })).status()).toBe(403);
  expect((await api(request, 'otherStudent', `/students/me/invitations/${ownerInvitation}/respond`, { method: 'PATCH', data: { expectedStatus: 'ACCEPTED', status: 'DECLINED' } })).status()).toBe(403);
  expect((await api(request, 'student', '/companies/me/interviews')).status()).toBe(403);
  expect((await api(request, 'company', '/students/me/invitations')).status()).toBe(403);
  expect((await api(request, 'admin', '/companies/me/interviews')).status()).toBe(403);
  expect((await api(request, 'otherCompany', '/companies/me/interviews', { method: 'POST', data: { applicationId: ids.application, title: 'Denied foreign creation', scheduledAt: fixture.futureAt, durationMinutes: 60, meetingType: 'ONSITE', locationOrLink: 'Synthetic room' } })).status()).toBe(403);
  expect((await api(request, 'company', '/companies/me/invitations', { method: 'POST', data: { studentId: ids.otherStudent, jobId: ids.conflictJob } })).status()).toBe(403);
  for (const [alias, expectedCompany, expectedStudent] of [['company', ids.company, ids.student], ['student', ids.company, ids.student], ['otherCompany', ids.otherCompany, ids.otherStudent], ['otherStudent', ids.otherCompany, ids.otherStudent]]) {
    for (const feature of ['interviews', 'invitations']) {
      const rows = await all(request, alias, feature); expect(rows.length).toBeGreaterThan(0);
      expect(rows.every(row => row.companyId === expectedCompany && row.studentId === expectedStudent)).toBe(true);
    }
  }
  await signIn(page); await page.goto('/recruiter/invitations'); await expect(page.getByRole('heading', { name: 'Lời mời đã gửi', exact: true })).toBeVisible();
  expect((await control('hold')).held).toBe(true);
  // Observe before navigation: StrictMode can start/cancel an earlier request immediately.
  const oldRequests = [], failedRequests = new Set(); let capture = true, pendingAtSwitch = [];
  const captureRequest = r => { if (capture && new URL(r.url()).pathname === '/api/companies/me/interviews' && r.method() === 'GET') oldRequests.push(r); };
  const captureFailure = r => { if (oldRequests.includes(r)) failedRequests.add(r); };
  page.on('request', captureRequest); page.on('requestfailed', captureFailure);
  try {
    await page.goto('/recruiter/interviews', { waitUntil: 'domcontentloaded' });
    await expect.poll(async () => (await control('waiters')).waiting, { timeout: 10_000 }).toBeGreaterThan(0);
    pendingAtSwitch = oldRequests.filter(r => !failedRequests.has(r)); expect(pendingAtSwitch.length).toBeGreaterThan(0); capture = false;
    await logout(page);
    await expect.poll(() => pendingAtSwitch.some(r => failedRequests.has(r)), { timeout: 5000 }).toBe(true);
    await signIn(page, 'otherCompany');
    await page.goto('/recruiter/interviews', { waitUntil: 'domcontentloaded' });
    expect((await control('release')).released).toBe(true);
    await expect(page.getByRole('heading', { name: 'Foreign private interview', exact: true })).toBeVisible();
    await expect(page.getByText('E01 scheduled interview', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Historical confirmed completion', { exact: true })).toHaveCount(0);
    expect(pendingAtSwitch.some(r => /ABORT|CANCEL|FAILED/i.test(r.failure()?.errorText ?? ''))).toBe(true);
  } finally { page.off('request', captureRequest); page.off('requestfailed', captureFailure); await control('release'); }
  fs.writeFileSync(path.join(local, 'late-response-evidence.json'), JSON.stringify({ realPostgresTableLock: true, pendingBeforeSwitch: pendingAtSwitch.length, cancelledPendingRequests: pendingAtSwitch.filter(r => failedRequests.has(r)).length, currentAccountOnly: true }, null, 2));
  await database();
});

test('E10 Persistence, deep pagination, foreign/unknown detail and real API-error feedback', async ({ page, request }) => {
  await signIn(page); const seen = [], featurePaths = [];
  page.on('request', r => { const p = new URL(r.url()).pathname; if (/\/api\/(companies|students)\/me\/(interviews|invitations)(\/|$)/.test(p)) featurePaths.push(p); });
  page.on('request', r => { const url = new URL(r.url()); if (/\/api\/(companies|students)\/me\/(interviews|invitations)$/.test(url.pathname)) seen.push({ path: url.pathname, page: url.searchParams.get('page'), size: url.searchParams.get('size') }); });
  await page.goto('/recruiter/interviews'); await expect(page.getByRole('button', { name: 'Sau', exact: true })).toBeEnabled();
  await page.reload(); await expect(page.getByRole('button', { name: 'Sau', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Sau', exact: true }).click(); await expect(page.getByText(/Trang 2\//)).toBeVisible();
  await page.goto(`/recruiter/interviews/${ids.deepInterview}`); await expect(page.getByRole('heading', { name: 'Deep historical interview', exact: true })).toBeVisible();
  expect(seen.some(r => r.path === '/api/companies/me/interviews' && r.page === '2' && r.size === '100')).toBe(true);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Deep historical interview', exact: true })).toBeVisible();
  await logout(page); await signIn(page, 'student');
  await page.goto('/candidate/invitations'); await expect(page.getByRole('button', { name: 'Sau', exact: true })).toBeEnabled();
  await page.reload(); await expect(page.getByRole('button', { name: 'Sau', exact: true })).toBeEnabled();
  await page.goto(`/candidate/invitations/${ids.deepInvitation}`); await expect(page.getByText('Deep historical invitation', { exact: true })).toBeVisible();
  expect(seen.some(r => r.path === '/api/students/me/invitations' && r.page === '2' && r.size === '100')).toBe(true);
  await page.reload(); await expect(page.getByText('Deep historical invitation', { exact: true })).toBeVisible();
  await page.goto(`/candidate/interviews/${ids.foreignInterview}`);
  await expect(page.getByRole('alert')).toContainText('Không tìm thấy hồ sơ');
  await expect(page.getByText('Foreign private interview', { exact: true })).toHaveCount(0); await expect(page.getByText('Chưa có lịch phỏng vấn.', { exact: true })).toHaveCount(0);
  await page.goto('/candidate/invitations/999999'); await expect(page.getByRole('alert')).toContainText('Không tìm thấy hồ sơ');
  await expect(page.getByText('Chưa có lời mời ứng tuyển.', { exact: true })).toHaveCount(0);
  await logout(page); await signIn(page);
  const failure = responseFor(page, `/companies/me/applications/${ids.foreignApplication}`);
  await page.goto(`/recruiter/invitations/create?applicationId=${ids.foreignApplication}`); expect((await failure).status()).toBe(403);
  await expect(page.getByRole('alert')).toContainText('Bạn không có quyền'); await expect(page.getByRole('button', { name: 'Gửi lời mời ứng tuyển', exact: true })).toBeDisabled();
  await expect(page.getByText('Chưa có lời mời ứng tuyển.', { exact: true })).toHaveCount(0);
  expect((await data(request, 'company', `/companies/me/applications/${ids.application}`)).status).toBe('REVIEWED');
  expect(featurePaths.length).toBeGreaterThan(0); expect(featurePaths.every(p => /\/api\/(companies|students)\/me\/(interviews|invitations)$/.test(p))).toBe(true);
  const snapshot = await database(); expect(snapshot.migrationVersions).toEqual(fixture.initialDatabase.migrationVersions); expect(snapshot.postgresMajor).toBe(17);
});
