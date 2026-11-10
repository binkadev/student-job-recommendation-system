import { test, expect } from '@playwright/test';
import { readLocal, writeLocal } from '../helpers.mjs';

const fixture = readLocal('w1b1-fixture.json');
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(fixture.backendUrl)) throw new Error('Isolated loopback fixture required');
const { accounts } = fixture;
const evidence = { fixture: 'disposable PostgreSQL Testcontainer', cases: {} };

async function signIn(page, alias = 'company') {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(accounts[alias].email);
  await page.locator('input[name="password"]').fill(accounts[alias].password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/recruiter/dashboard');
}

test.afterEach(() => writeLocal('w1b1-evidence.json', evidence));
test.describe.configure({ mode: 'serial' });

test('B1-01 Company profile loads owner-scoped ACTIVE jobs with pagination via /companies/me/jobs', async ({ page }) => {
  await signIn(page);
  const requests = [];
  page.on('request', r => {
    const p = new URL(r.url()).pathname;
    if (p === '/api/jobs' || p === '/api/companies/me/jobs') requests.push({ path: p, search: new URL(r.url()).search });
  });

  const p1Resp = page.waitForResponse(r => new URL(r.url()).pathname === '/api/companies/me/jobs' && new URL(r.url()).searchParams.get('page') === '1');
  await page.goto('/recruiter/company');
  const p1Data = (await (await p1Resp).json()).data;
  expect(p1Data.totalItems).toBe(7);
  expect(p1Data.size).toBe(5);
  expect(p1Data.totalPages).toBe(2);
  expect(p1Data.items.every(j => j.companyId === accounts.company.companyId && j.status === 'ACTIVE')).toBe(true);

  for (const job of p1Data.items) {
    await expect(page.getByText(job.title, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('Owned Draft Job 01 (No Applicants)')).toHaveCount(0);
  await expect(page.getByText('Foreign Active Job 99')).toHaveCount(0);

  const p2Resp = page.waitForResponse(r => new URL(r.url()).pathname === '/api/companies/me/jobs' && new URL(r.url()).searchParams.get('page') === '2');
  await page.getByRole('button', { name: /Sau|2/ }).first().click();
  const p2Data = (await (await p2Resp).json()).data;
  expect(p2Data.items).toHaveLength(2);
  for (const job of p2Data.items) {
    await expect(page.getByText(job.title, { exact: true })).toBeVisible();
  }
  expect(requests.some(r => r.path === '/api/jobs')).toBe(false);
  evidence.cases.B1_01 = { totalActive: p1Data.totalItems, p1Count: p1Data.items.length, p2Count: p2Data.items.length, mixedJobsCalled: false };
});

test('B1-02 Candidate job filter includes owned jobs without applicants via /companies/me/jobs', async ({ page }) => {
  await signIn(page);
  const jobsResp = page.waitForResponse(r => new URL(r.url()).pathname === '/api/companies/me/jobs' && new URL(r.url()).searchParams.get('size') === '100');
  await page.goto('/recruiter/candidates');
  const jobsData = (await (await jobsResp).json()).data;
  expect(jobsData.totalItems).toBe(8); // 7 active + 1 draft, all with 0 applications

  const select = page.getByLabel('Vị trí tuyển dụng', { exact: true });
  await expect(select).toBeEnabled();
  const options = await select.locator('option').allTextContents();
  expect(options).toContain('Owned Active Job 01 (No Applicants)');
  expect(options).toContain('Owned Active Job 07 (No Applicants)');
  expect(options).toContain('Owned Draft Job 01 (No Applicants)');
  expect(options).not.toContain('Foreign Active Job 99');
  evidence.cases.B1_02 = { optionCount: options.length, zeroApplicantJobsIncluded: true };
});

test('B1-03 & B1-04 Job form accepts Backend text limits (255/10000) and persists skill importance & minimum level after reload', async ({ page }) => {
  await signIn(page);
  await page.goto('/recruiter/jobs/create');

  const longTitle = 'T'.repeat(255);
  const longDesc = 'D'.repeat(10000);
  const longReq = 'R'.repeat(10000);
  const longBen = 'B'.repeat(10000);

  await page.getByLabel('Tiêu đề', { exact: true }).fill(longTitle);
  await expect(page.getByText('255/255 ký tự')).toBeVisible();
  await page.getByLabel('Địa điểm', { exact: true }).selectOption('Hà Nội');
  await page.getByLabel('Hạn nộp', { exact: true }).fill('2099-12-31');

  await page.getByLabel('Mô tả công việc', { exact: true }).fill(longDesc);
  await page.getByLabel('Yêu cầu', { exact: true }).fill(longReq);
  await page.getByLabel('Quyền lợi', { exact: true }).fill(longBen);
  await expect(page.getByText('10000/10000 ký tự')).toHaveCount(3);

  await page.getByRole('checkbox', { name: 'Java Backend', exact: true }).check();
  await page.getByRole('checkbox', { name: /^React/ }).check();

  await page.getByLabel('Mức độ quan trọng - Java', { exact: true }).selectOption('PREFERRED');
  await page.getByLabel('Trình độ tối thiểu - Java', { exact: true }).selectOption('ADVANCED');
  await page.getByLabel('Mức độ quan trọng - React', { exact: true }).selectOption('NICE_TO_HAVE');
  await page.getByLabel('Trình độ tối thiểu - React', { exact: true }).selectOption('INTERMEDIATE');

  const postResp = page.waitForResponse(r => new URL(r.url()).pathname === '/api/jobs' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  const created = (await (await postResp).json()).data;
  expect(created.title).toHaveLength(255);
  expect(created.description).toHaveLength(10000);
  await expect(page).toHaveURL(`/recruiter/jobs/${created.id}`);

  // Navigate to edit and reload the browser to verify persisted values
  await page.goto(`/recruiter/jobs/${created.id}/edit`);
  await page.reload();

  await expect(page.getByLabel('Tiêu đề', { exact: true })).toHaveValue(longTitle);
  await expect(page.getByLabel('Mô tả công việc', { exact: true })).toHaveValue(longDesc);
  await expect(page.getByLabel('Mức độ quan trọng - Java', { exact: true })).toHaveValue('PREFERRED');
  await expect(page.getByLabel('Trình độ tối thiểu - Java', { exact: true })).toHaveValue('ADVANCED');
  await expect(page.getByLabel('Mức độ quan trọng - React', { exact: true })).toHaveValue('NICE_TO_HAVE');
  await expect(page.getByLabel('Trình độ tối thiểu - React', { exact: true })).toHaveValue('INTERMEDIATE');

  // Edit another field and save to verify existing skill settings are preserved on PUT
  await page.getByLabel('Tiêu đề', { exact: true }).fill('Updated W1-B1 Draft Title');
  const putResp = page.waitForResponse(r => new URL(r.url()).pathname === `/api/jobs/${created.id}` && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Lưu nháp', exact: true }).click();
  const updated = (await (await putResp).json()).data;
  const byName = Object.fromEntries(updated.skills.map(s => [s.skillName, { importance: s.importance, minLevel: s.minLevel }]));
  expect(byName.Java).toEqual({ importance: 'PREFERRED', minLevel: 'ADVANCED' });
  expect(byName.React).toEqual({ importance: 'NICE_TO_HAVE', minLevel: 'INTERMEDIATE' });

  await page.reload();
  await expect(page.getByLabel('Mức độ quan trọng - Java', { exact: true })).toHaveValue('PREFERRED');
  await expect(page.getByLabel('Trình độ tối thiểu - Java', { exact: true })).toHaveValue('ADVANCED');
  await expect(page.getByLabel('Mức độ quan trọng - React', { exact: true })).toHaveValue('NICE_TO_HAVE');
  await expect(page.getByLabel('Trình độ tối thiểu - React', { exact: true })).toHaveValue('INTERMEDIATE');

  evidence.cases.B1_03_04 = {
    createdJobId: created.id,
    titleLength: created.title.length,
    descriptionLength: created.description.length,
    skillsAfterReloadAndEdit: byName,
  };
});
