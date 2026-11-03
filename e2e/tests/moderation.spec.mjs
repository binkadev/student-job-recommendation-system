import { test, expect } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { api, ok, login, devAdmin, credentials, writeLocal } from '../helpers.mjs';

// Dedicated durable fixtures: never moderate the PRIMARY company's existing jobs.
const alias = 'moderationCompany';
const evidence = { transitions: [] };
let owner, admin, student, other, company;
const payload = title => ({ title, description: 'Build Java services with a mentor. Synthetic local moderation fixture.', requirements: 'Java and Git basics.', benefits: 'Mentoring.', location: 'Hà Nội', jobType: 'INTERNSHIP', workingModel: 'HYBRID', deadline: '2099-12-31', status: 'DRAFT' });

test.beforeAll(async () => {
  admin = await devAdmin();
  if (!admin) throw new Error('Moderation E2E requires E2E_USE_DEV_SEED_ADMIN=1 and a valid existing Admin. No bypass.');
  const creds = credentials();
  if (!creds[alias]) {
    creds[alias] = { email: 'datn-e2e-v1.moderationcompany@datn-e2e.invalid', password: `E2e!${randomBytes(24).toString('base64url')}9a`, role: 'COMPANY', fullName: 'Moderation E2E Owner', companyName: 'Moderation E2E Company' };
    writeLocal('credentials.json', creds);
  }
  const account = creds[alias];
  const trial = await api('POST', '/auth/login', null, { email: account.email, password: account.password });
  if (!trial.success) {
    expect((await api('POST', '/auth/register', null, account)).status).toBe(201);
    owner = await login(alias);
    expect((await ok('GET', '/companies/me', owner)).status).toBe('PENDING');
    evidence.freshRegistration = { http: 201, companyStatus: 'PENDING' };
  } else {
    owner = trial.data.token;
    evidence.registrationReused = true; // Fresh registration is also asserted by PostgreSQL IT.
  }
  company = await ok('GET', '/companies/me', owner);
  student = await login('student'); other = await login('companyB');
  evidence.companyId = company.id;
});
test.afterEach(() => writeLocal('moderation-evidence.json', evidence));

async function check(role, token, method, route, body, expected, before, after) {
  const result = await api(method, route, token, body);
  evidence.transitions.push({ role, method, route, before, action: body?.status ?? method, expected, actual: result.status, after: result.data?.status ?? after });
  expect(result.status, `${role} ${before} ${method} ${route} ${body?.status ?? ''}`).toBe(expected);
  if (expected === 200 && after) expect(result.data.status).toBe(after);
  return result.data;
}
async function verification(status) {
  const before = (await ok('GET', '/companies/me', owner)).status;
  await check('ADMIN', admin, 'PATCH', `/admin/companies/${company.id}/status`, { status }, 200, before, status);
}
async function fixture(key) {
  const title = `Moderation ${key} [p0-e2e]`;
  let job = (await ok('GET', `/jobs?keyword=${encodeURIComponent(title)}&size=100`, owner)).items.find(j => j.companyId === company.id && j.title === title);
  if (!job) job = await ok('POST', '/jobs', owner, payload(title));
  if (job.status === 'ACTIVE') job = await ok('DELETE', `/jobs/${job.id}`, owner);
  if (job.status !== 'DRAFT') job = await ok('PATCH', `/jobs/${job.id}/status`, owner, { status: 'DRAFT' });
  // Only this dedicated DRAFT is normalized. Existing demo records are untouched.
  const { status, ...content } = payload(title);
  job = await ok('PUT', `/jobs/${job.id}`, owner, content);
  return job;
}
async function transition(job, role, token, target, expected = 200) {
  const before = (await ok('GET', `/jobs/${job.id}`, owner)).status;
  await check(role, token, 'PATCH', `/jobs/${job.id}/status`, { status: target }, expected, before, expected === 200 ? target : before);
  expect((await ok('GET', `/jobs/${job.id}`, owner)).status).toBe(expected === 200 ? target : before);
}
async function signIn(page) {
  const account = credentials()[alias];
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/recruiter/dashboard');
}

test('M01 PENDING Company can save DRAFT in UI, cannot self-verify/publish/submit', async ({ page }) => {
  await verification('PENDING');
  const job = await fixture('draft');
  for (const status of ['ACTIVE', 'REJECTED', 'EXPIRED']) {
    await check('COMPANY', owner, 'POST', '/jobs', { ...payload('Forbidden publication'), status }, 403, 'NEW');
  }
  await check('COMPANY', owner, 'POST', '/jobs', { ...payload('Forbidden submission'), status: 'PENDING_APPROVAL' }, 403, 'NEW');
  await check('COMPANY', owner, 'PATCH', `/admin/companies/${company.id}/status`, { status: 'VERIFIED' }, 403, 'PENDING');
  await transition(job, 'COMPANY', owner, 'PENDING_APPROVAL', 403);
  await transition(job, 'COMPANY', owner, 'ACTIVE', 403);
  await signIn(page);
  await page.goto('/recruiter/jobs/create');
  await expect(page.getByLabel('Tiêu đề', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu nháp', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Tạo tin', exact: true })).toBeDisabled();
  await page.goto(`/recruiter/jobs/${job.id}/edit`);
  await page.getByLabel('Quyền lợi', { exact: true }).fill('Mentoring while verification is pending.');
  const saved = page.waitForResponse(r => r.url().endsWith(`/api/jobs/${job.id}`) && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Gửi duyệt', exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel('Quyền lợi', { exact: true })).toHaveValue('Mentoring while verification is pending.');
  expect((await api('GET', `/public/jobs/${job.id}`)).status).toBe(404);
  evidence.M01 = { draftSavedInBrowser: true, pendingSubmitDisabled: true, publicHidden: true };
});

test('M02 review authorization and browser close → draft → edit → submit → withdraw', async ({ page }) => {
  await verification('VERIFIED');
  const job = await fixture('review');
  await transition(job, 'ADMIN', admin, 'ACTIVE', 400);
  await transition(job, 'COMPANY', owner, 'PENDING_APPROVAL');
  for (const [role, token] of [['COMPANY', owner], ['COMPANY_B', other], ['STUDENT', student]]) {
    await transition(job, role, token, 'ACTIVE', 403);
  }
  for (const [role, token] of [['COMPANY_B', other], ['STUDENT', student]]) {
    await check(role, token, 'PUT', `/jobs/${job.id}`, { title: 'Unauthorized edit' }, 403, 'PENDING_APPROVAL');
    await check(role, token, 'DELETE', `/jobs/${job.id}`, undefined, 403, 'PENDING_APPROVAL');
    await check(role, token, 'PATCH', `/admin/companies/${company.id}/status`, { status: 'VERIFIED' }, 403, 'VERIFIED');
  }
  await check('STUDENT', student, 'POST', '/jobs', payload('Forbidden student job'), 403, 'NEW');
  await transition(job, 'ADMIN', admin, 'REJECTED');
  await transition(job, 'COMPANY', owner, 'DRAFT');
  await transition(job, 'COMPANY', owner, 'PENDING_APPROVAL');
  await transition(job, 'ADMIN', admin, 'ACTIVE');
  await check('COMPANY', owner, 'PUT', `/jobs/${job.id}`, { title: 'Unreviewed edit' }, 400, 'ACTIVE');
  expect((await ok('GET', `/jobs/${job.id}`, owner)).title).toBe(job.title);
  await signIn(page);
  await page.goto(`/recruiter/jobs/${job.id}/edit`);
  await expect(page.getByRole('heading', { name: 'Chuẩn bị chỉnh sửa tin', exact: true })).toBeVisible();
  await expect(page.getByLabel('Tiêu đề', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Đóng tin để chỉnh sửa', exact: true }).click();
  expect((await ok('GET', `/jobs/${job.id}`, owner)).status).toBe('ACTIVE');
  await page.getByRole('button', { name: 'Xác nhận đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Đưa về nháp', exact: true }).click();
  await page.getByLabel('Quyền lợi', { exact: true }).fill('Reviewed content after explicit close.');
  await page.getByRole('button', { name: 'Gửi duyệt', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rút về nháp', exact: true })).toBeVisible();
  expect((await ok('GET', `/jobs/${job.id}`, owner)).status).toBe('PENDING_APPROVAL');
  await page.reload();
  await page.getByRole('button', { name: 'Rút về nháp', exact: true }).click();
  await expect(page.getByLabel('Quyền lợi', { exact: true })).toHaveValue('Reviewed content after explicit close.');
  await check('COMPANY', owner, 'PUT', `/jobs/${job.id}`, { status: 'ACTIVE' }, 400, 'DRAFT');
  await transition(job, 'COMPANY', owner, 'CLOSED');
  await transition(job, 'COMPANY', owner, 'PENDING_APPROVAL', 400);
  await transition(job, 'ADMIN', admin, 'ACTIVE', 400);
  evidence.M02 = { closeConfirmed: true, contentEditRestricted: true, resubmitPending: true, withdrawPersisted: true };
});

test('M03 Admin blocking hides ACTIVE Job without rewriting it; Student/public UI agree', async ({ page }) => {
  await verification('VERIFIED');
  const job = await fixture('visibility');
  await transition(job, 'COMPANY', owner, 'PENDING_APPROVAL');
  await transition(job, 'ADMIN', admin, 'ACTIVE');
  const active = await ok('GET', `/jobs/${job.id}`, owner);
  expect((await api('GET', `/public/jobs/${job.id}`)).status).toBe(200);
  for (const state of ['PENDING', 'BLOCKED']) {
    await verification(state);
    expect((await api('GET', `/public/jobs/${job.id}`)).status).toBe(404);
    expect((await api('GET', `/public/companies/${company.id}`)).status).toBe(404);
    expect((await api('GET', `/jobs/${job.id}`, student)).status).toBe(403);
    expect((await ok('GET', '/jobs?keyword=p0-e2e&size=100', student)).items.some(j => j.id === job.id)).toBe(false);
    await check('STUDENT', student, 'POST', `/jobs/${job.id}/apply`, {}, 400, 'ACTIVE');
    await transition(job, 'ADMIN', admin, 'ACTIVE', 403);
    const unchanged = await ok('GET', `/jobs/${job.id}`, owner);
    expect(unchanged.status).toBe('ACTIVE'); expect(unchanged.updatedAt).toBe(active.updatedAt);
    await page.goto(`/jobs?q=${encodeURIComponent(job.title)}`);
    await expect(page.getByText('Không có kết quả phù hợp với bộ lọc hiện tại.', { exact: true })).toBeVisible();
  }
  const account = credentials().student;
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/candidate/dashboard');
  await page.goto(`/candidate/jobs/${job.id}`);
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: job.title, exact: true })).toHaveCount(0);
  await verification('VERIFIED');
  await page.goto(`/jobs/${job.id}`);
  await expect(page.getByRole('heading', { name: job.title, exact: true })).toBeVisible();
  // Finish with no extra public jobs; original nine aliases and jobs remain unchanged.
  await transition(job, 'COMPANY', owner, 'CLOSED');
  await verification('PENDING');
  evidence.M03 = { visibilityHiddenPendingAndBlocked: true, jobTimestampUnchanged: true, adminReverificationRestored: true };
});

test('M04 competing Admin decisions serialize on the real PostgreSQL service', async () => {
  await verification('VERIFIED');
  const job = await fixture('race');
  const rounds = [];
  for (let round = 0; round < 3; round++) {
    await transition(job, 'COMPANY', owner, 'PENDING_APPROVAL');
    const decisions = await Promise.all(['ACTIVE', 'REJECTED'].map(status => api('PATCH', `/jobs/${job.id}/status`, admin, { status })));
    const statuses = decisions.map(r => r.status).sort();
    expect(statuses).toEqual([200, 400]); rounds.push(statuses);
    const current = await ok('GET', `/jobs/${job.id}`, owner);
    if (current.status === 'ACTIVE') await transition(job, 'COMPANY', owner, 'CLOSED');
    await transition(job, 'COMPANY', owner, 'DRAFT');
  }
  await transition(job, 'COMPANY', owner, 'CLOSED');
  await verification('PENDING');
  evidence.M04 = { rounds };
});
