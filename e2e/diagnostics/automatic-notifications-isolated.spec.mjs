import { test, expect } from '@playwright/test';
import { readLocal, writeLocal } from '../helpers.mjs';

// W1-C: every notification below is produced by the REAL Backend event (HTTP), against a disposable
// PostgreSQL Testcontainer. The AI Service used for Recommendation V3 is the stateless local one.
const fixture = readLocal('w1c-fixture.json');
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(fixture.backendUrl)) throw new Error('Isolated loopback fixture required');
const { accounts, entities } = fixture;
const evidence = { fixture: 'disposable PostgreSQL Testcontainer', cases: {} };
const state = {};
async function request(method, path, token, body, headers = {}) {
  const response = await fetch(`${fixture.backendUrl}/api${path}`, { method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(120_000) });
  return { status: response.status, etag: response.headers.get('ETag'), ...await response.json() };
}
async function token(alias) {
  const { email, password } = accounts[alias];
  return (await request('POST', '/auth/login', null, { email, password })).data.token;
}
async function signIn(page, alias) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(accounts[alias].email);
  await page.locator('input[name="password"]').fill(accounts[alias].password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/(candidate|recruiter)\/dashboard/);
}
const inboxPath = alias => alias.toLowerCase().includes('student') ? '/candidate/notifications' : '/recruiter/settings/notifications';
async function inbox(page, alias) {
  await page.goto(inboxPath(alias));
  const region = page.getByRole('region', { name: 'Danh sách thông báo', exact: true });
  await expect(region.getByText(/thông báo phù hợp/)).toBeVisible();
  return region;
}
async function apiInbox(alias) { return (await request('GET', '/notifications?size=50', await token(alias))).data; }
test.afterEach(() => writeLocal('w1c-evidence.json', evidence));
test.describe.configure({ mode: 'serial' });

test('N01 apply: owning Company sees a localised unread notice and opens the application', async ({ page }) => {
  const student = await token('student');
  const applied = await request('POST', `/jobs/${entities.activeJobId}/apply`, student, { coverLetter: 'W1C browser' });
  expect(applied.status).toBe(200);
  state.applicationId = applied.data.id;
  expect(await request('POST', `/jobs/${entities.activeJobId}/apply`, student, { coverLetter: 'dup' })).toMatchObject({ status: 409 });
  await signIn(page, 'company');
  const region = await inbox(page, 'company');
  await expect(region.getByRole('article')).toHaveCount(1);
  const article = region.getByRole('article', { name: 'New application received' });
  await expect(article.getByRole('heading', { name: 'Có đơn ứng tuyển mới' })).toBeVisible();
  await expect(article).toContainText('đã ứng tuyển vào Isolated Java Backend Role');
  await expect(article).toContainText('Chưa đọc');
  await page.screenshot({ path: 'test-results/w1c-company-apply.png' });
  await article.getByRole('button', { name: 'Mở', exact: true }).click();
  await expect(page).toHaveURL(`/recruiter/candidates/${state.applicationId}`);
  await expect(page.getByText('Isolated student').first()).toBeVisible();
  const items = (await apiInbox('company')).items;
  expect(items[0]).toMatchObject({ referenceType: 'APPLICATION', referenceId: state.applicationId, isRead: true });
  evidence.cases.N01 = { notifications: items.length, navigatedTo: page.url().replace(/^https?:\/\/[^/]+/, '') };
});

test('N02 withdraw: Company gets exactly one more notice; duplicate withdraw is rejected', async ({ page }) => {
  const student = await token('student');
  expect((await request('PATCH', `/applications/${state.applicationId}/status`, student, { status: 'WITHDRAWN' })).status).toBe(200);
  expect((await request('PATCH', `/applications/${state.applicationId}/status`, student, { status: 'WITHDRAWN' })).status).toBe(400);
  await signIn(page, 'company');
  const region = await inbox(page, 'company');
  await expect(region.getByRole('article')).toHaveCount(2);
  const article = region.getByRole('article', { name: 'Application withdrawn' });
  await expect(article).toContainText('đã rút đơn ứng tuyển vào Isolated Java Backend Role');
  await article.getByRole('button', { name: 'Mở', exact: true }).click();
  await expect(page).toHaveURL(`/recruiter/candidates/${state.applicationId}`);
  evidence.cases.N02 = { companyNotifications: (await apiInbox('company')).totalItems, studentNotifications: (await apiInbox('student')).totalItems };
});

test('N03 Job moderation: approve notifies owner once and links to the Job; owner cannot self-approve', async ({ page }) => {
  expect((await request('PATCH', `/jobs/${entities.pendingJobId}/status`, await token('company'), { status: 'ACTIVE' })).status).toBe(403);
  const admin = await token('admin');
  expect((await request('PATCH', `/jobs/${entities.pendingJobId}/status`, admin, { status: 'ACTIVE' })).status).toBe(200);
  expect((await request('PATCH', `/jobs/${entities.pendingJobId}/status`, admin, { status: 'ACTIVE' })).status).toBe(200);
  await signIn(page, 'company');
  const region = await inbox(page, 'company');
  const article = region.getByRole('article', { name: 'Job approved' });
  await expect(region.getByRole('article', { name: 'Job approved' })).toHaveCount(1);
  await expect(article).toContainText('Isolated Pending Review Role');
  await article.getByRole('button', { name: 'Mở', exact: true }).click();
  await expect(page).toHaveURL(`/recruiter/jobs/${entities.pendingJobId}`);
  await expect(page.getByText('Isolated Pending Review Role').first()).toBeVisible();
  evidence.cases.N03 = { approvedNotices: 1, otherCompany: (await apiInbox('otherCompany')).totalItems };
});

test('N04 Company verification/block notifies the Company user and falls back to the inbox', async ({ page }) => {
  const admin = await token('admin');
  const id = entities.pendingCompanyCompanyId;
  expect((await request('PATCH', `/admin/companies/${id}/status`, await token('pendingCompany'), { status: 'VERIFIED' })).status).toBe(403);
  expect((await request('PATCH', `/admin/companies/${id}/status`, admin, { status: 'VERIFIED' })).status).toBe(200);
  expect((await request('PATCH', `/admin/companies/${id}/status`, admin, { status: 'VERIFIED' })).status).toBe(200);
  expect((await request('PATCH', `/admin/companies/${id}/status`, admin, { status: 'BLOCKED' })).status).toBe(200);
  await signIn(page, 'pendingCompany');
  const region = await inbox(page, 'pendingCompany');
  await expect(region.getByRole('article')).toHaveCount(2);
  await expect(region.getByRole('article', { name: 'Company verified' })).toContainText('đã được xác thực');
  await expect(region.getByRole('article', { name: 'Company blocked' })).toContainText('bị quản trị viên khóa');
  await region.getByRole('article', { name: 'Company verified' }).getByRole('button', { name: 'Mở', exact: true }).click();
  await expect(page).toHaveURL('/recruiter/settings/notifications');
  evidence.cases.N04 = { notices: (await apiInbox('pendingCompany')).items.map(item => [item.title, item.referenceType]) };
});

test('N05 Recommendation V3 (real AI Service): Student notified once, no cross-user leak', async ({ page }) => {
  const student = await token('student');
  const run = await request('POST', '/students/me/recommendations/generate', student, { cvId: entities.cvId, threshold: 0, limit: 5 });
  expect([200, 201]).toContain(run.status);
  expect(run.data.status).toBe('SUCCESS');
  await signIn(page, 'student');
  const region = await inbox(page, 'student');
  const article = region.getByRole('article', { name: 'Job recommendations are ready' });
  await expect(article).toHaveCount(1);
  await expect(article).toContainText('Lượt gợi ý đã hoàn tất');
  await page.screenshot({ path: 'test-results/w1c-student-recommendation.png' });
  await article.getByRole('button', { name: 'Mở', exact: true }).click();
  await expect(page).toHaveURL('/candidate/jobs/recommended');
  const items = (await apiInbox('student')).items;
  expect(items.find(item => item.type === 'RECOMMENDATION')).toMatchObject({ referenceType: 'RECOMMENDATION_RUN', referenceId: run.data.id });
  expect((await apiInbox('otherStudent')).totalItems).toBe(0);
  evidence.cases.N05 = { runId: run.data.id, studentNotifications: items.length };
});

test('N06 preference: disabled application type suppresses Company notices while the operation succeeds', async () => {
  const company = await token('company');
  const before = (await apiInbox('company')).totalItems;
  const current = await request('GET', '/users/me/notification-settings', company);
  const saved = await request('PUT', '/users/me/notification-settings', company,
    { applicationStatusEnabled: false, jobStatusEnabled: true, recommendationEnabled: true, systemEnabled: true }, { 'If-Match': current.etag });
  expect(saved.status).toBe(200);
  const applied = await request('POST', `/jobs/${entities.activeJobId}/apply`, await token('otherStudent'), { coverLetter: 'muted' });
  expect(applied.status).toBe(200);
  expect((await apiInbox('company')).totalItems).toBe(before);
  evidence.cases.N06 = { before, after: (await apiInbox('company')).totalItems, applyStatus: applied.status };
});
