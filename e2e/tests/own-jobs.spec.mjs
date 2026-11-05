import { test, expect } from '@playwright/test';
import path from 'node:path';
import { credentials, login, ok, api, local, writeLocal } from '../helpers.mjs';

const endpoint = '/api/companies/me/jobs';
const evidence = {};
test.afterEach(() => writeLocal('own-jobs-browser-evidence.json', evidence));
async function signIn(page, alias = 'company') {
  const account = credentials()[alias]; await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/recruiter/dashboard');
}
function nextPage(page, predicate = () => true) {
  return page.waitForResponse(r => new URL(r.url()).pathname === endpoint && r.request().method() === 'GET' && predicate(new URL(r.url()).searchParams));
}
async function rendered(page, data) {
  await expect(page.getByText(`${data.totalItems} tin tuyển dụng • Trang ${data.page}/${Math.max(1, data.totalPages)}`, { exact: true })).toBeVisible();
  if (!data.items.length) await expect(page.getByText('Không có tin tuyển dụng phù hợp.', { exact: true })).toBeVisible();
  for (const job of data.items) {
    await expect(page.getByText(job.title, { exact: true })).toBeVisible();
    await expect(page.getByRole('row').filter({ has: page.getByText(job.title, { exact: true }) }).getByRole('link', { name: 'Xem', exact: true })).toHaveAttribute('href', `/recruiter/jobs/${job.id}`);
  }
}
async function responseData(response) { const r = await response; expect(r.status()).toBe(200); return (await r.json()).data; }

test('J01 primary Company server pages/filters, confirmed snapshot retained offline, explicit recovery', async ({ page, context }) => {
  const token = await login('company'), company = await ok('GET', '/companies/me', token);
  await signIn(page);
  let response = nextPage(page); await page.goto('/recruiter/jobs');
  const first = await responseData(response); await rendered(page, first);
  expect(first.totalItems).toBe(16); expect(first.size).toBe(8); expect(first.totalPages).toBe(2);
  expect(first.items.every(j => j.companyId === company.id)).toBe(true);
  const pager = page.getByRole('navigation', { name: 'Phân trang', exact: true });
  const jobRequests = [];
  page.on('request', r => { if (r.method() === 'GET' && ['/api/jobs', endpoint].includes(new URL(r.url()).pathname)) jobRequests.push(new URL(r.url()).pathname); });
  response = nextPage(page, p => p.get('page') === '2'); await pager.getByRole('button', { name: 'Sau', exact: true }).click();
  const second = await responseData(response); await rendered(page, second);
  expect(new Set([...first.items, ...second.items].map(j => j.id)).size).toBe(16);
  await context.setOffline(true);
  try {
    await page.getByLabel('Từ khóa', { exact: true }).fill('NoMatchesOwnedP1');
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(page.getByText('16 tin tuyển dụng • Trang 2/2', { exact: true })).toBeVisible();
    for (const job of second.items) await expect(page.getByText(job.title, { exact: true })).toBeVisible();
    await expect(page.getByText('Không có tin tuyển dụng phù hợp.', { exact: true })).toHaveCount(0);
    await expect(pager.getByRole('button', { name: 'Trước', exact: true })).toBeDisabled();
    await expect(page.getByRole('status')).toContainText('lần tải thành công gần nhất');
  } finally { await context.setOffline(false); }
  response = nextPage(page, p => p.get('page') === '1' && p.get('keyword') === 'NoMatchesOwnedP1');
  await page.getByRole('button', { name: 'Thử tải lại', exact: true }).click();
  const empty = await responseData(response); expect(empty.totalItems).toBe(0); await rendered(page, empty);
  response = nextPage(page, p => !p.has('keyword')); await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await rendered(page, await responseData(response));
  await page.getByLabel('Từ khóa', { exact: true }).fill('Java');
  response = nextPage(page, p => p.get('keyword') === 'React'); await page.getByLabel('Từ khóa', { exact: true }).fill('React');
  const latest = await responseData(response); await rendered(page, latest); expect(latest.page).toBe(1);
  response = nextPage(page, p => p.get('status') === 'DRAFT'); await page.getByLabel('Trạng thái', { exact: true }).selectOption('DRAFT');
  const filtered = await responseData(response); await rendered(page, filtered);
  expect(filtered.items.every(j => j.status === 'DRAFT')).toBe(true);
  expect(jobRequests.every(p => p === endpoint)).toBe(true);
  evidence.J01 = { firstPageIds: first.items.map(j => j.id), secondPageIds: second.items.map(j => j.id), total: first.totalItems, ownerId: company.id, offlineSnapshotPreserved: true, recoveryEmptyConfirmed: true, latestFilterTotal: latest.totalItems, statusFilterTotal: filtered.totalItems, discoveryRequests: 0 };
});

test('J02 secondary Company creates one bounded DRAFT through UI, edits and refreshes legal status changes', async ({ page }) => {
  const token = await login('companyB'), company = await ok('GET', '/companies/me', token);
  expect(company.status).toBe('VERIFIED');
  const title = 'Own paging draft [p1-e2e]';
  let job = (await ok('GET', `/companies/me/jobs?keyword=${encodeURIComponent(title)}&size=100`, token)).items.find(j => j.title === title);
  if (job && job.status !== 'DRAFT') {
    if (!['PENDING_APPROVAL', 'CLOSED', 'REJECTED', 'EXPIRED'].includes(job.status)) throw new Error('Dedicated draft fixture has an unexpected published status; do not change it silently.');
    job = await ok('PATCH', `/jobs/${job.id}/status`, token, { status: 'DRAFT' });
  }
  await signIn(page, 'companyB'); let created = false;
  if (!job) {
    await page.goto('/recruiter/jobs/create');
    await page.getByLabel('Tiêu đề', { exact: true }).fill(title);
    await page.getByLabel('Địa điểm', { exact: true }).selectOption({ label: 'Hà Nội' });
    await page.getByLabel('Hạn nộp', { exact: true }).fill('2099-12-31');
    await page.getByLabel('Mô tả công việc', { exact: true }).fill('Synthetic secondary draft for owned pagination E2E. Work with a mentor on Java services.');
    await page.getByRole('checkbox', { name: /^Git/ }).check();
    const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/jobs' && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
    const result = await saved; expect(result.status()).toBe(200); job = (await result.json()).data; created = true;
    await expect(page).toHaveURL(`/recruiter/jobs/${job.id}`);
  }
  expect(job.status).toBe('DRAFT'); expect(job.companyId).toBe(company.id);
  await page.goto(`/recruiter/jobs/${job.id}/edit`);
  await page.getByLabel('Quyền lợi', { exact: true }).fill('Read-back of a dedicated secondary owned-job draft.');
  let saved = page.waitForResponse(r => r.url().endsWith(`/api/jobs/${job.id}`) && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click(); expect((await saved).status()).toBe(200);
  let response = nextPage(page); await page.goto('/recruiter/jobs'); let data = await responseData(response); await rendered(page, data);
  expect(data.items.every(j => j.companyId === company.id)).toBe(true);
  response = nextPage(page, p => p.get('keyword') === title); await page.getByLabel('Từ khóa', { exact: true }).fill(title);
  data = await responseData(response); await rendered(page, data); expect(data.totalItems).toBe(1);
  let refreshed = nextPage(page);
  saved = page.waitForResponse(r => r.url().endsWith(`/api/jobs/${job.id}/status`) && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Gửi duyệt', exact: true }).click(); expect((await saved).status()).toBe(200);
  await rendered(page, await responseData(refreshed));
  await expect(page.getByRole('button', { name: 'Rút về nháp', exact: true })).toBeVisible();
  refreshed = nextPage(page); saved = page.waitForResponse(r => r.url().endsWith(`/api/jobs/${job.id}/status`) && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Rút về nháp', exact: true }).click(); expect((await saved).status()).toBe(200);
  await rendered(page, await responseData(refreshed));
  response = nextPage(page); await page.reload(); await rendered(page, await responseData(response));
  expect((await ok('GET', `/jobs/${job.id}`, token)).status).toBe('DRAFT');
  expect((await api('GET', `/public/jobs/${job.id}`)).status).toBe(404);
  evidence.J02 = { id: job.id, companyId: company.id, createdInBrowser: created, durableFixtureReused: !created, status: 'DRAFT', editPersisted: true, submitWithdrawRefreshed: true, publicHttp: 404 };
});

for (const width of [375, 430, 768, 1024, 1440]) test(`J03-${width} owned jobs responsive server-page controls`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await signIn(page);
  const response = nextPage(page); await page.goto('/recruiter/jobs'); const data = await responseData(response); await rendered(page, data);
  await expect(page.getByRole('navigation', { name: 'Phân trang', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: path.join(local, `screenshots/own-jobs-${width}.png`), fullPage: true });
  evidence[`J03-${width}`] = { totalItems: data.totalItems, page: data.page, size: data.size, noDocumentOverflow: true };
});
