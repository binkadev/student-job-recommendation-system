import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { login, credentials, ok, writeLocal } from '../helpers.mjs';
import { parseCsv } from '../analytics-csv.mjs';
const evidence = {};
async function signIn(page, alias, role) { await page.goto('/login'); await page.getByRole('textbox', { name: 'Email', exact: true }).fill(credentials()[alias].email); await page.locator('input[name="password"]').fill(credentials()[alias].password); await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click(); await expect(page).toHaveURL(`/${role}/dashboard`); }
test.afterEach(() => writeLocal('analytics-demo-evidence.json', evidence));
test('D01 PRIMARY Company reads full Dashboard and filtered Reports and downloads owned CSV without mutation', async ({ page }) => {
  const auth = await login('company'); await signIn(page, 'company', 'recruiter');
  const data = await ok('GET', '/companies/me/dashboard-summary', auth);
  await expect(page.getByText('Tổng ứng tuyển', { exact: true }).locator('..')).toContainText(String(data.summary.totalApplications));
  await expect(page.getByText('Tin đang tuyển', { exact: true }).locator('..')).toContainText(String(data.jobCounts.ACTIVE));
  await page.getByLabel('Khoảng thời gian', { exact: true }).selectOption('7');
  await expect(page.getByRole('table', { name: 'Số đơn từng kỳ UTC', exact: true }).locator('tbody tr')).toHaveCount(7);
  await page.goto('/recruiter/reports'); const report = await ok('GET', '/companies/me/recruitment-report', auth);
  await expect(page.getByText('Đơn trong phạm vi lọc', { exact: true }).locator('..')).toContainText(String(report.summary.totalApplications));
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Xuất toàn bộ CSV theo bộ lọc', exact: true }).click();
  const rows = parseCsv(fs.readFileSync(await (await download).path(), 'utf8'));
  expect(rows.length - 1).toBe(report.summary.totalApplications);
  const ids = new Set();
  for (let page = 1; ; page++) { const apps = await ok('GET', `/companies/me/applications?size=100&page=${page}`, auth); for (const app of apps.items) ids.add(app.id); if (page >= apps.totalPages) break; }
  expect(rows.slice(1).every(row => ids.has(Number(row[0])))).toBe(true);
  evidence.D01 = { serverTotal: report.summary.totalApplications, csvRows: rows.length - 1, primaryMutations: 0 };
});
test('D02 Student Dashboard main counts match API totals and offline reload shows error, never fabricated zeros', async ({ page, context }) => {
  const auth = await login('student'); await signIn(page, 'student', 'candidate');
  const [jobs, saved, apps, cvs] = await Promise.all([ok('GET', '/public/jobs?size=1', auth), ok('GET', '/students/me/saved-jobs?size=1', auth), ok('GET', '/students/me/applications', auth), ok('GET', '/students/me/cv', auth)]);
  for (const [name, count] of [['Việc đang tuyển', jobs.totalItems], ['Việc đã lưu', saved.totalItems], ['Đơn ứng tuyển', apps.length], ['Tổng CV', cvs.length]]) await expect(page.getByRole('link', { name: new RegExp(`${name}.*${count}`) })).toBeVisible();
  await context.setOffline(true);
  try { await page.getByRole('link', { name: /Đơn ứng tuyển/ }).first().click(); await page.goBack(); await expect(page.getByRole('alert')).toBeVisible(); expect(await page.getByRole('link', { name: /Việc đang tuyển.*0 việc/ }).count()).toBe(0); }
  finally { await context.setOffline(false); }
  await page.reload(); await expect(page.getByRole('link', { name: new RegExp(`Tổng CV.*${cvs.length}`) })).toBeVisible();
  evidence.D02 = { correctTotals: true, offlineUnknown: true, recovered: true };
});
