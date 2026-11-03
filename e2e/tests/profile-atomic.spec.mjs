import { test, expect } from '@playwright/test';
import { api, ok, login, credentials, writeLocal } from '../helpers.mjs';

const route = '/students/me/profile-aggregate';
const alias = 'studentUi'; // Existing secondary account; never use PRIMARY for negative cases.
const evidence = { checks: [] };
test.afterEach(() => writeLocal('profile-atomic-evidence.json', evidence));
async function signIn(page) {
  const account = credentials()[alias];
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(account.email);
  await page.locator('input[name="password"]').fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/candidate/dashboard');
}
async function read(token) { return ok('GET', route, token); }
async function checked(method, path, token, body, expected, headers) {
  const result = await api(method, path, token, body, headers);
  evidence.checks.push({ method, path, expected, actual: result.status, errorCode: result.errorCode, revision: result.data?.revision });
  expect(result.status).toBe(expected); return result;
}
async function edit(page, name, summary) {
  await page.getByRole('button', { name: 'Thông tin cá nhân', exact: true }).click();
  await page.getByLabel('Họ tên', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Giới thiệu', exact: true }).click();
  await page.getByLabel('Giới thiệu bản thân', { exact: true }).fill(summary);
}
function saving(page) { return page.waitForResponse(r => r.url().endsWith(`/api${route}`) && r.request().method() === 'PUT'); }

test('P01 two real Student tabs: atomic save, stale conflict, retained draft, explicit compare/reload/retry', async ({ page, context }) => {
  const token = await login(alias);
  const initial = await read(token);
  await ok('PUT', route, token, { revision: initial.revision, student: { fullName: 'Atomic Profile Student', location: 'Hà Nội' }, profile: { summary: 'Atomic seed summary', education: 'School line one\nSchool line two', projects: 'Keep this secondary project.' } });
  const base = await read(token);
  await signIn(page);
  const tabB = await context.newPage();
  try {
    await signIn(tabB);
    for (const tab of [page, tabB]) {
      const loaded = tab.waitForResponse(r => r.url().endsWith(`/api${route}`) && r.request().method() === 'GET');
      await tab.goto('/candidate/profile/edit');
      expect((await (await loaded).json()).data.revision).toBe(base.revision);
      await expect(tab.getByLabel('Họ tên', { exact: true })).toHaveValue('Atomic Profile Student');
    }
    await edit(page, 'Atomic Tab A', 'Tab A committed summary');
    await edit(tabB, 'Atomic Tab B draft', 'Tab B unsaved summary');
    // Add a bounded named skill only once; subsequent runs reuse it.
    const skillName = 'Atomic browser skill [e2e]';
    await page.getByRole('button', { name: 'Kỹ năng', exact: true }).click();
    if (!base.skills.some(s => s.skillName === skillName)) {
      await page.getByRole('button', { name: 'Thêm', exact: true }).click();
      await page.getByLabel('Tên kỹ năng', { exact: true }).last().fill(skillName);
    } else {
      const inputs = page.getByLabel('Tên kỹ năng', { exact: true });
      for (let i = 0; i < await inputs.count(); i++) if (await inputs.nth(i).inputValue() === skillName) {
        const row = inputs.nth(i).locator('xpath=ancestor::fieldset[1]');
        await expect(row.getByLabel('Nhóm', { exact: true })).toBeDisabled();
        const stored = base.skills.find(s => s.skillName === skillName);
        await row.getByLabel('Số năm kinh nghiệm', { exact: true }).fill(stored.yearsOfExperience === 1 ? '2' : '1');
      }
    }
    const mutationsA = [], mutationsB = [];
    for (const [tab, mutations] of [[page, mutationsA], [tabB, mutationsB]]) tab.on('request', request => {
      if (request.method() === 'PUT' && new URL(request.url()).pathname.startsWith('/api/students/me')) mutations.push(new URL(request.url()).pathname);
    });
    const aSaved = saving(page); await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    const responseA = await aSaved; expect(responseA.status()).toBe(200);
    const a = (await responseA.json()).data;
    expect(a.revision).toBe(base.revision + 1); expect(a.student.fullName).toBe('Atomic Tab A'); expect(a.profile.summary).toBe('Tab A committed summary');
    expect(a.skills.some(s => s.skillName === skillName)).toBe(true);
    expect(mutationsA).toEqual([`/api${route}`]);
    const bSaved = saving(tabB); await tabB.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    expect((await bSaved).status()).toBe(409);
    await expect(tabB.getByRole('alert').first()).toContainText('phiên khác');
    await expect(tabB.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveValue('Tab B unsaved summary');
    await expect(tabB.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toBeDisabled();
    expect((await read(token)).student.fullName).toBe('Atomic Tab A');
    await tabB.getByRole('button', { name: 'Tải bản mới để đối chiếu', exact: true }).click();
    await expect(tabB.getByRole('heading', { name: 'Đối chiếu hồ sơ', exact: true })).toBeVisible();
    await expect(tabB.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveValue('Tab B unsaved summary');
    await expect(tabB.getByRole('cell', { name: 'Tab A committed summary', exact: true })).toBeVisible();
    expect(mutationsB).toHaveLength(1); // Loading the latest snapshot never retries/rebases the draft.
    await tabB.getByRole('button', { name: 'Thay bản nháp bằng bản mới', exact: true }).click();
    await expect(tabB.getByRole('dialog')).toBeVisible();
    await tabB.getByRole('button', { name: 'Xác nhận tải lại', exact: true }).click();
    await expect(tabB.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveValue('Tab A committed summary');
    await edit(tabB, 'Atomic Reviewed Student', 'Reviewed after comparing the server version');
    const retry = saving(tabB); await tabB.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
    const retryResponse = await retry; expect(retryResponse.status()).toBe(200);
    const final = (await retryResponse.json()).data; expect(final.revision).toBe(base.revision + 2);
    expect(mutationsB).toEqual([`/api${route}`, `/api${route}`]);
    await tabB.reload();
    await expect(tabB.getByLabel('Giới thiệu bản thân', { exact: true })).toHaveValue('Reviewed after comparing the server version');
    expect((await read(token)).profile.education).toBe(base.profile.education);
    expect((await read(token)).profile.projects).toBe(base.profile.projects);
    evidence.P01 = { initialRevision: base.revision, committedRevision: a.revision, retriedRevision: final.revision, statuses: [200, 409, 200], retainedDraft: true, explicitReload: true, mutationSections: Object.keys(responseA.request().postDataJSON()), mutationsA, mutationsB };
  } finally { await tabB.close(); }
});

test('P02 real validation/skill rollback and all legacy preconditions preserve data and revision', async () => {
  const token = await login(alias), primary = await login('student');
  const baseline = await read(token), primaryBefore = await read(primary);
  await checked('PUT', route, token, { revision: baseline.revision, student: { fullName: 'Must not persist' }, profile: { summary: 'x'.repeat(5001) } }, 400);
  expect(await read(token)).toEqual(baseline);
  await checked('PUT', route, token, { revision: baseline.revision, student: { fullName: 'Must rollback' }, profile: { summary: 'Must rollback' }, manualSkills: [{ skillId: Number.MAX_SAFE_INTEGER, source: 'MANUAL', proficiencyLevel: 'BEGINNER' }] }, 404);
  expect(await read(token)).toEqual(baseline);
  await checked('PUT', route, token, { revision: baseline.revision, studentId: primaryBefore.student.id, profile: { summary: 'Forged ownership' } }, 400);
  expect(await read(primary)).toEqual(primaryBefore);
  let revision = baseline.revision;
  for (const path of ['/students/me', '/students/me/profile', '/students/me/skills']) {
    const body = path.endsWith('skills') ? { skills: baseline.skills.map(s => ({ skillId: s.skillId, proficiencyLevel: s.proficiencyLevel, yearsOfExperience: s.yearsOfExperience, source: s.source })) } : {};
    const missing = await checked('PUT', path, token, body, 428);
    expect(missing.errorCode).toBe('PROFILE_REVISION_REQUIRED');
    const valid = await checked('PUT', path, token, body, 200, { 'If-Match': `"${revision}"` });
    expect(valid.etag).toBe(`"${revision + 1}"`);
    expect(valid.data.revision).toBeUndefined();
    const stale = await checked('PUT', path, token, body, 409, { 'If-Match': `"${revision}"` });
    expect(stale.errorCode).toBe('PROFILE_REVISION_CONFLICT');
    await checked('PUT', route, token, { revision, profile: { summary: 'Stale aggregate' } }, 409);
    revision++;
  }
  expect((await read(token)).revision).toBe(revision);
  evidence.P02 = { validationRollback: true, skillRollback: true, ownershipDenied: true, legacyRevisionIncrements: 3, primaryUnchanged: true };
});

test('P03 offline error keeps draft; controlled double-click retry performs one real mutation', async ({ page, context }) => {
  const token = await login(alias), before = await read(token);
  await signIn(page); await page.goto('/candidate/profile/edit?section=summary');
  const summary = page.getByLabel('Giới thiệu bản thân', { exact: true });
  await summary.fill('Offline-safe secondary profile draft.');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  await expect(page.getByRole('alert').first()).toContainText('Chưa xác nhận');
  await expect(summary).toHaveValue('Offline-safe secondary profile draft.');
  await expect(page.getByText('Đã lưu hồ sơ', { exact: true })).toHaveCount(0);
  await context.setOffline(false);
  expect((await read(token)).revision).toBe(before.revision);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 500, downloadThroughput: -1, uploadThroughput: -1 });
  let mutations = 0;
  page.on('request', r => { if (r.url().endsWith(`/api${route}`) && r.method() === 'PUT') mutations++; });
  const success = saving(page); await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).dblclick({ delay: 50 });
  expect((await success).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Lưu hồ sơ', exact: true })).toBeEnabled();
  expect(mutations).toBe(1);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await cdp.detach();
  await page.reload(); await expect(summary).toHaveValue('Offline-safe secondary profile draft.');
  expect((await read(token)).revision).toBe(before.revision + 1);
  evidence.P03 = { offlineDraftRetained: true, falseSuccess: false, retryMutations: mutations, revisionIncrement: 1 };
});

test('P04 real preferences/settings consumers send captured If-Match and keep stale drafts', async ({ page, context }) => {
  const token = await login(alias);
  await signIn(page); await page.goto('/candidate/profile/preferences');
  await expect(page.getByLabel('Vị trí mong muốn', { exact: true })).toBeVisible();
  const settings = await context.newPage();
  try {
    await signIn(settings); await settings.goto('/candidate/settings/account');
    const name = settings.getByLabel('Họ tên', { exact: true }); await expect(name).toBeVisible();
    await name.fill('Stale settings draft');
    await page.getByLabel('Vị trí mong muốn', { exact: true }).fill('Stale preference draft');
    const baseline = await read(token);
    await ok('PUT', route, token, { revision: baseline.revision, profile: { summary: 'Changed in another active session.' } });
    const preferenceResponse = page.waitForResponse(r => r.url().endsWith('/api/students/me/profile') && r.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Lưu thiết lập', exact: true }).click();
    const pref = await preferenceResponse; expect(pref.status()).toBe(409); expect(pref.request().headers()['if-match']).toBe(`"${baseline.revision}"`);
    await expect(page.getByLabel('Vị trí mong muốn', { exact: true })).toHaveValue('Stale preference draft');
    const accountResponse = settings.waitForResponse(r => new URL(r.url()).pathname === '/api/students/me' && r.request().method() === 'PUT');
    await settings.getByRole('button', { name: 'Cập nhật thông tin', exact: true }).click();
    const account = await accountResponse; expect(account.status()).toBe(409); expect(account.request().headers()['if-match']).toBe(`"${baseline.revision}"`);
    await expect(name).toHaveValue('Stale settings draft');
    expect((await read(token)).student.fullName).toBe(baseline.student.fullName);
    evidence.P04 = { preferencesStatus: 409, settingsStatus: 409, capturedPrecondition: true, bothDraftsRetained: true };
  } finally { await settings.close(); }
});
