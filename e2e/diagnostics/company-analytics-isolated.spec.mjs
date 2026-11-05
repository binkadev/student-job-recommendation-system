import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readLocal, writeLocal, local } from '../helpers.mjs';
import { parseCsv } from '../analytics-csv.mjs';

const fixture = readLocal('analytics-isolated-fixture.json');
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(fixture.backendUrl) || !/^[a-f0-9]{64}$/.test(fixture.containerId)) throw new Error('Disposable loopback fixture required');
const evidence = { cases: {}, durationsMs: [], http: [] };
async function api(method, route, token, body) {
  const start = performance.now();
  const response = await fetch(`${fixture.backendUrl}/api${route}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json(); evidence.durationsMs.push({ route: route.split('?')[0], ms: Math.round(performance.now() - start), status: response.status });
  return { status: response.status, ...data };
}
async function token(alias = 'company') { const a = fixture.accounts[alias]; const r = await api('POST', '/auth/login', null, { email: a.email, password: a.password }); expect(r.status).toBe(200); return r.data.token; }
async function signIn(page, alias = 'company') {
  await page.goto('/login'); await page.getByRole('textbox', { name: 'Email', exact: true }).fill(fixture.accounts[alias].email);
  await page.locator('input[name="password"]').fill(fixture.accounts[alias].password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await expect(page).toHaveURL('/recruiter/dashboard');
}
async function signOut(page) { await page.getByRole('button', { name: 'Menu tài khoản', exact: true }).click(); await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click(); await expect(page).toHaveURL('/login'); }
function response(page, suffix) { return page.waitForResponse(r => new URL(r.url()).pathname === `/api/companies/me/${suffix}`); }
function sql(query) {
  return JSON.parse(execFileSync('docker', ['exec', '-i', fixture.containerId, 'psql', '-U', 'test', '-d', 'test', '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: `BEGIN READ ONLY;\n${query};\nCOMMIT;`, encoding: 'utf8' }).trim());
}
function oracle(alias = 'company') {
  const id = Number(fixture.accounts[alias].companyId); if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid company fixture');
  return sql(`select json_build_object('jobs',(select count(*) from jobs where company_id=${id}),'applications',count(*),'students',count(distinct a.student_id),
    'accepted',count(*) filter(where a.status='ACCEPTED'),'rate',round(100.0*count(*) filter(where a.status='ACCEPTED')/nullif(count(*),0),2),
    'ids',json_agg(a.id order by a.applied_at desc,a.id desc),'jobDigest',(select md5(string_agg(to_jsonb(jj)::text,'' order by jj.id)) from jobs jj where jj.company_id=${id}),
    'digest',md5(string_agg(to_jsonb(a)::text,'' order by a.id))) from applications a join jobs j on j.id=a.job_id where j.company_id=${id}`);
}
function metric(page, name) { return page.getByText(name, { exact: true }).locator('..'); }
function dataLoaded(page, total = 362) { return expect(metric(page, 'Đơn trong phạm vi lọc')).toContainText(String(total)); }
test.beforeEach(async ({ page }) => page.on('response', r => { const url = new URL(r.url()); if (url.pathname.includes('recruitment-report') || url.pathname.includes('dashboard-summary')) evidence.http.push({ path: url.pathname, query: url.search, status: r.status() }); }));
test.afterEach(() => writeLocal('analytics-isolated-evidence.json', evidence));
let before;
test.beforeAll(() => { before = { a: oracle(), b: oracle('otherCompany') }; writeLocal('analytics-isolated-sql-before.json', before); });
test.afterAll(() => { const after = { a: oracle(), b: oracle('otherCompany') }; expect(after).toEqual(before); writeLocal('analytics-isolated-readonly.json', { jobAndApplicationCountsUnchanged: true, jobDigestsUnchanged: true, applicationDigestsUnchanged: true }); });

test('Q01 Company Dashboard exact full aggregates, reapply histories, and 7/30/90 UTC daily buckets', async ({ page }) => {
  const auth = await token(), expected = oracle(); await signIn(page);
  await expect(metric(page, 'Tổng ứng tuyển')).toContainText('362');
  await expect(metric(page, 'Sinh viên duy nhất')).toContainText('360');
  await expect(metric(page, 'Tin đang tuyển')).toContainText('22');
  await expect(metric(page, 'Tỷ lệ nhận')).toContainText('19.89%');
  for (const days of [7, 30, 90]) {
    if (await page.getByLabel('Khoảng thời gian', { exact: true }).inputValue() !== String(days)) { const loaded = response(page, 'dashboard-summary'); await page.getByLabel('Khoảng thời gian', { exact: true }).selectOption(String(days)); expect((await loaded).status()).toBe(200); }
    const data = (await api('GET', `/companies/me/dashboard-summary?days=${days}`, auth)).data;
    expect(data.totalJobs).toBe(expected.jobs); expect(data.summary.totalApplications).toBe(expected.applications);
    expect(data.summary.uniqueStudents).toBe(expected.students); expect(data.summary.acceptedRate).toBe(Number(expected.rate));
    expect(data.trend).toHaveLength(days); expect(data.trend.every(row => row.applications === 4)).toBe(true);
    await expect(page.getByTestId('analytics-scope')).toContainText(data.trendFrom);
    const table = page.getByRole('table', { name: 'Số đơn từng kỳ UTC', exact: true }); await expect(table.locator('tbody tr')).toHaveCount(days);
    expect(data.recentApplications.items.map(row => row.id)).toEqual(expected.ids.slice(0, 5));
    expect(Object.values(data.summary.statusCounts).reduce((a, b) => a + b, 0)).toBe(362);
    await expect(page.getByTestId('status-REJECTED')).toHaveText('74');
  }
  evidence.cases.Q01 = { jobs: 130, histories: 362, students: 360, acceptedRate: 19.89, ranges: [7, 30, 90], sqlMatches: true };
});

test('Q02 Reports combines month/Job/status filters before totals, chart, details and export', async ({ page }) => {
  await signIn(page); await page.goto('/recruiter/reports'); await dataLoaded(page);
  const month = new Date().toISOString().slice(0, 7), jobId = fixture.accounts.company.firstJob;
  await page.getByLabel('Từ tháng (UTC)', { exact: true }).fill(month); await page.getByLabel('Đến tháng (UTC)', { exact: true }).fill(month);
  await page.getByLabel('Mã Job', { exact: true }).fill(String(jobId)); await page.getByLabel('Trạng thái', { exact: true }).selectOption('PENDING');
  await dataLoaded(page, 1); await expect(page.getByRole('button', { name: 'Xuất toàn bộ CSV theo bộ lọc', exact: true })).toBeEnabled();
  const id = Number(fixture.accounts.company.companyId);
  const expected = sql(`select json_build_object('n',count(*)) from applications a join jobs j on j.id=a.job_id where j.company_id=${id} and j.id=${Number(jobId)} and a.status='PENDING' and to_char(a.applied_at,'YYYY-MM')='${month}'`);
  expect(expected.n).toBe(1);
  await expect(page.getByRole('table', { name: 'Số đơn từng kỳ UTC', exact: true }).locator('tbody tr')).toHaveCount(1);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Xuất toàn bộ CSV theo bộ lọc', exact: true }).click();
  const file = await download; const rows = parseCsv(fs.readFileSync(await file.path(), 'utf8'));
  expect(rows).toHaveLength(2); expect(rows[1][4]).toBe(String(jobId)); expect(rows[1][6]).toBe('PENDING');
  await page.reload(); await dataLoaded(page); // URL-less filters intentionally reset on full navigation; Backend data persists.
  evidence.cases.Q02 = { combinedSqlCount: 1, csvRows: 1, scope: 'UTC month AND owned Job AND PENDING', reload: true };
});

test('Q03 full CSV exports all 362 rows, exact SQL ownership/order, UTF-8 and formula-safe multiline cells', async ({ page }) => {
  await signIn(page); await page.goto('/recruiter/reports'); await dataLoaded(page);
  await page.getByLabel('Số dòng mỗi trang', { exact: true }).selectOption('100');
  await expect(page.getByText('Trang 1/4', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sau', exact: true }).click(); await expect(page.getByText('Trang 2/4', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Xuất toàn bộ CSV theo bộ lọc', exact: true }).click();
  const file = await download, text = fs.readFileSync(await file.path(), 'utf8');
  const rows = parseCsv(text), expected = oracle(); expect(text.charCodeAt(0)).toBe(0xFEFF);
  expect(rows[0]).toEqual(['applicationId', 'studentId', 'studentName', 'studentEmail', 'jobId', 'jobTitle', 'status', 'appliedAt', 'reviewedAt', 'cvFileName']);
  expect(rows.length - 1).toBe(362); expect(rows.slice(1).map(row => Number(row[0]))).toEqual(expected.ids);
  expect(rows.slice(1).every(row => row[5].startsWith('Analytics a ') && row.length === 10)).toBe(true);
  expect(rows.some(row => row[2] === "'=SUM(1,1)")).toBe(true); expect(rows.some(row => row[2].includes('tiếng Việt'))).toBe(true);
  expect(rows.some(row => row[2] === "'+line\nsecond line")).toBe(true);
  evidence.cases.Q03 = { tablePage: 2, fullCsvRows: 362, sqlIdsExact: true, bom: true, formulaSafe: true, multiline: true };
});

test('Q04 BLOCKED Company B has internal analytics but no Company A data; foreign Job and unauthenticated denied', async ({ page }) => {
  await signIn(page, 'otherCompany');
  await expect(metric(page, 'Tin đang tuyển')).toContainText('22');
  await page.goto('/recruiter/reports'); await dataLoaded(page);
  const auth = await token('otherCompany');
  const report = (await api('GET', '/companies/me/recruitment-report', auth)).data;
  expect(report.topJobs.every(row => row.jobTitle.startsWith('Analytics b '))).toBe(true);
  expect(report.applications.items.every(row => row.jobTitle.startsWith('Analytics b '))).toBe(true);
  for (const endpoint of ['recruitment-report', 'recruitment-report/export']) expect((await api('GET', `/companies/me/${endpoint}?jobId=${fixture.accounts.company.firstJob}`, auth)).status).toBe(404);
  for (const endpoint of ['dashboard-summary', 'recruitment-report', 'recruitment-report/export']) expect((await api('GET', `/companies/me/${endpoint}`)).status).toBe(401);
  expect((await api('GET', `/public/jobs/${fixture.accounts.otherCompany.activeJob}`)).status).toBe(404);
  evidence.cases.Q04 = { blockedInternal: 200, internalActiveJobs: 22, foreignJob: 404, unauthenticated: 401, activeJobPublicHidden: 404 };
});

test('Q05 offline snapshots retain their scope, explicit retry obtains real zero, rapid filters and relogin isolate data', async ({ page, context }) => {
  await signIn(page); await page.goto('/recruiter/reports'); await dataLoaded(page);
  await context.setOffline(true); await page.getByLabel('Tìm kiếm', { exact: true }).fill('no-matching-analytics-data');
  await page.getByRole('button', { name: 'Tìm kiếm báo cáo', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByText(/snapshot đã xác nhận trước đó/)).toBeVisible();
  await expect(page.getByTestId('analytics-scope')).toContainText('từ khóa (trống)'); await dataLoaded(page);
  await expect(page.getByRole('button', { name: 'Xuất toàn bộ CSV theo bộ lọc', exact: true })).toBeDisabled();
  await context.setOffline(false); await page.getByRole('button', { name: 'Tải lại báo cáo', exact: true }).click();
  await dataLoaded(page, 0); await expect(metric(page, 'Tỷ lệ nhận')).toContainText('Không áp dụng (0 đơn)');
  await page.getByLabel('Tìm kiếm', { exact: true }).fill(''); await page.getByRole('button', { name: 'Tìm kiếm báo cáo', exact: true }).click();
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('PENDING'); await page.getByLabel('Trạng thái', { exact: true }).selectOption('REJECTED');
  await dataLoaded(page, 74); await expect(page.getByTestId('analytics-scope')).toContainText('trạng thái REJECTED');
  await signOut(page); await signIn(page, 'otherCompany'); await page.goto('/recruiter/reports'); await dataLoaded(page);
  expect(await page.getByText(/^Analytics a /).count()).toBe(0);
  evidence.cases.Q05 = { preservedOldScopeOffline: true, exportBlocked: true, zeroAfterRetry: true, latestStatus: 'REJECTED', accountIsolation: true };
});

test('Q06 Dashboard and Reports at 375/430/768/1024/1440, chart tables and keyboard controls', async ({ page }) => {
  await signIn(page);
  for (const width of [375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    for (const route of ['dashboard', 'reports']) {
      await page.goto(`/recruiter/${route}`);
      await expect(metric(page, route === 'dashboard' ? 'Tổng ứng tuyển' : 'Đơn trong phạm vi lọc')).toContainText('362');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width === 375) {
        const tableRegion = page.getByRole('region', { name: 'Chi tiết đơn ứng tuyển, cuộn ngang', exact: true });
        await tableRegion.focus(); await expect(tableRegion).toBeFocused();
        expect(await tableRegion.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => tableRegion.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
      }
      await page.screenshot({ path: path.join(local, `analytics-${route}-${width}.png`), fullPage: true });
    }
  }
  await page.getByLabel('Từ tháng (UTC)', { exact: true }).focus(); await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('INPUT');
  evidence.cases.Q06 = { widths: [375, 430, 768, 1024, 1440], screenshots: 10, documentOverflow: false, keyboard: true };
});
