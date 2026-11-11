import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const fixturePath = process.env.APPLICATION_MESSAGING_FIXTURE;
if (!fixturePath) throw new Error('Dedicated isolated messaging runner required');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(fixture.backendUrl)) throw new Error('Disposable loopback Backend required');
const local = path.dirname(fixturePath), ids = fixture.ids, tokens = new Map();
const statePath = path.join(local, 'scenario-state.json'), evidencePath = path.join(local, 'evidence.json');
const state = () => fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
function save(values) { fs.writeFileSync(statePath, JSON.stringify({ ...state(), ...values })); }
function required(name) { const value = state()[name]; if (!value) throw new Error(`Missing preceding scenario artifact: ${name}`); return value; }
let protocol = [], resourceFailures = [];
function record(method, route, status) {
  if (/^\/api\/(conversations|students\/me\/applications|companies\/me\/applications|public\/)/.test(route)) protocol.push({ method, path: route, status });
}
test.beforeEach(async ({ page }) => {
  protocol = []; resourceFailures = [];
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/')) record(response.request().method(), url.pathname, response.status());
    else if (response.status() >= 400) resourceFailures.push({ path: url.pathname, status: response.status() });
  });
  page.on('requestfailed', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) record(request.method(), url.pathname, 'transport-failed');
    else resourceFailures.push({ path: url.pathname, failure: request.failure()?.errorText });
  });
});
test.afterEach(async ({}, info) => {
  const evidence = fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, 'utf8')) : { realFrontend: true, realBackend: true, postgresMajor: 17, mocks: false, retries: 0, cases: {} };
  // No request/response bodies, headers, credentials, tokens or message content in protocol evidence.
  evidence.cases[info.title] = { result: info.status, expected: info.expectedStatus, durationMs: info.duration, protocol, resourceFailures };
  fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
});
async function api(request, alias, route, options = {}) {
  if (alias && !tokens.has(alias)) {
    const account = fixture.accounts[alias];
    const login = await request.post(`${fixture.backendUrl}/api/auth/login`, { data: { email: account.email, password: account.password } });
    if (login.status() !== 200) throw new Error('Synthetic real login failed');
    const token = (await login.json()).data?.token; if (!token) throw new Error('Real login returned no token'); tokens.set(alias, token);
  }
  const response = await request.fetch(`${fixture.backendUrl}/api${route}`, { ...options, headers: { ...(alias ? { Authorization: `Bearer ${tokens.get(alias)}` } : {}), ...options.headers } });
  record(options.method ?? 'GET', `/api${route.split('?')[0]}`, response.status());
  return response;
}
async function data(request, alias, route, options) {
  const response = await api(request, alias, route, options); expect(response.status()).toBe(200);
  const body = await response.json(); expect(body.success).toBe(true); return body.data;
}
async function control(action) {
  const id = randomUUID(), command = path.join(local, 'control.json'), reply = path.join(local, `reply-${id}.json`);
  fs.writeFileSync(command + '.tmp', JSON.stringify({ id, action })); fs.renameSync(command + '.tmp', command);
  await expect.poll(() => fs.existsSync(reply), { timeout: 12_000, intervals: [50, 100, 200] }).toBe(true);
  return JSON.parse(fs.readFileSync(reply, 'utf8'));
}
async function database() {
  const snapshot = await control('snapshot'), baseline = fixture.initialDatabase;
  expect(snapshot.postgresMajor).toBe(17); expect(snapshot.migrationVersions).toEqual(Array.from({ length: 25 }, (_, i) => String(i + 1)));
  expect(snapshot.migrationChecksums).toEqual(baseline.migrationChecksums); expect(snapshot.flywayValidated).toBe(true);
  expect(snapshot.business).toEqual(baseline.business);
  for (const key of ['tupleMismatchCount', 'senderMismatchCount', 'lastMessageMismatchCount']) expect(snapshot[key]).toBe(0);
  fs.writeFileSync(path.join(local, 'sql-integrity-summary.json'), JSON.stringify({ postgresMajor: 17, migrationVersions: snapshot.migrationVersions, flywayChecksumsValidated: true, protectedBusiness: snapshot.business, conversationCount: snapshot.conversationCount, messageCount: snapshot.messageCount, tupleMismatchCount: snapshot.tupleMismatchCount, senderMismatchCount: snapshot.senderMismatchCount, lastMessageMismatchCount: snapshot.lastMessageMismatchCount }, null, 2));
  return snapshot;
}
const rowsFor = (snapshot, id) => snapshot.messages.filter(row => row.conversation_id === id);
const mainId = () => required('conversation');
function responseFor(page, route, method = 'GET') { return page.waitForResponse(response => new URL(response.url()).pathname === `/api${route}` && response.request().method() === method); }
async function signIn(page, alias = 'student') {
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
async function openConversation(page, role, id = mainId()) {
  await page.goto(`/${role}/messages/${id}`);
  await expect(page.getByRole('heading', { name: `Hội thoại #${id}`, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi tin nhắn', exact: true })).toBeEnabled();
}
async function sendUi(page, content, id = mainId()) {
  const input = page.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true });
  await input.fill(content); expect(await input.inputValue()).toBe(content);
  const pending = responseFor(page, `/conversations/${id}/messages`, 'POST');
  await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
  const response = await pending; expect(response.status()).toBe(200); expect(response.request().postDataJSON()).toEqual({ content });
  const saved = (await response.json()).data;
  await expect(page.getByText('Tin nhắn đã được hệ thống xác nhận gửi.', { exact: true })).toBeVisible();
  await expect(page.getByRole('article', { name: `Tin nhắn đã gửi #${saved.id}`, exact: true })).toBeVisible();
  expect(await page.getByRole('article', { name: `Tin nhắn đã gửi #${saved.id}`, exact: true }).locator('p').nth(1).textContent()).toBe(content);
  return saved;
}
async function readUi(page, id = mainId()) {
  const pending = responseFor(page, `/conversations/${id}/read`, 'PATCH');
  await page.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true }).click();
  const response = await pending; expect(response.status()).toBe(200); expect(response.request().postData()).toBe(null);
  const saved = (await response.json()).data;
  await expect(page.getByText(`Đã đánh dấu ${saved.markedCount} tin nhắn đến là đã đọc trong hội thoại này.`, { exact: true })).toBeVisible();
  return saved;
}

test('M01 Student creates a real Application conversation with exact DTO and SQL ownership', async ({ page }) => {
  expect(fixture.activeProfiles).toEqual(['integration']); expect(fixture.hibernateSchemaValidation).toBe(true);
  const before = await database(); expect(before.business.applications.count).toBe(108);
  expect(before.business.cv_files.count).toBe(1); expect(before.business.interviews.count).toBe(1); expect(before.business.job_invitations.count).toBe(1);
  expect(before.migrationChecksums.every(row => Number.isInteger(row.checksum))).toBe(true);
  await signIn(page); await page.goto(`/candidate/applications/${ids.application}`);
  await expect(page.getByRole('button', { name: 'Nhắn tin', exact: true })).toBeVisible();
  const owned = responseFor(page, `/students/me/applications/${ids.application}`), pending = responseFor(page, '/conversations', 'POST');
  await page.getByRole('button', { name: 'Nhắn tin', exact: true }).click(); expect((await owned).status()).toBe(200);
  const response = await pending; expect(response.status()).toBe(200); expect(response.request().postDataJSON()).toEqual({ applicationId: ids.application });
  const saved = (await response.json()).data; expect(saved).toMatchObject({ applicationId: ids.application, companyId: ids.company, studentId: ids.student, jobId: ids.job });
  await expect(page).toHaveURL(`/candidate/messages/${saved.id}`); await expect(page.getByRole('heading', { name: `Hội thoại #${saved.id}`, exact: true })).toBeVisible();
  save({ conversation: saved.id }); const after = await database(); expect(after.conversationCount).toBe(before.conversationCount + 1);
  expect(after.conversations.filter(row => row.application_id === ids.application)).toEqual([expect.objectContaining({ id: saved.id, company_id: ids.company, student_id: ids.student })]);
});

test('M02 Company reuses the same conversation and both owned lists expose it without duplicates', async ({ page, request }) => {
  const before = await database(); await signIn(page, 'company'); await page.goto(`/recruiter/candidates/${ids.application}`);
  const pending = responseFor(page, '/conversations', 'POST'); await page.getByRole('button', { name: 'Nhắn tin', exact: true }).click();
  const response = await pending; expect(response.status()).toBe(200); expect((await response.json()).data.id).toBe(mainId());
  expect(response.request().postDataJSON()).toEqual({ applicationId: ids.application }); await expect(page).toHaveURL(`/recruiter/messages/${mainId()}`);
  await page.goto('/recruiter/messages'); await expect(page.getByRole('link', { name: `Hội thoại #${mainId()}`, exact: true })).toBeVisible();
  await logout(page); await signIn(page); await page.goto('/candidate/messages'); await expect(page.getByRole('link', { name: `Hội thoại #${mainId()}`, exact: true })).toBeVisible();
  for (const alias of ['student', 'company']) expect((await data(request, alias, '/conversations?page=1&size=10')).items.some(row => row.id === mainId())).toBe(true);
  const after = await database(); expect(after.conversationCount).toBe(before.conversationCount); expect(after.conversations.filter(row => row.application_id === ids.application)).toHaveLength(1);
});

test('M03 Student multiline Unicode send is confirmed once and received by Company with SQL agreement', async ({ page }) => {
  const before = await database(), content = `  Tổng hợp thử nghiệm ${randomUUID()}\nDòng hai: tiếng Việt và 😀  `;
  await signIn(page); await openConversation(page, 'candidate'); const saved = await sendUi(page, content);
  expect(saved.senderRole).toBe('STUDENT'); expect(saved.senderUserId).toBe(fixture.accounts.student.userId); save({ studentMessage: saved.id });
  await logout(page); await signIn(page, 'company'); await openConversation(page, 'recruiter');
  const pending = responseFor(page, `/conversations/${mainId()}/messages`); await page.getByRole('button', { name: 'Tải lại lịch sử', exact: true }).click(); expect((await pending).status()).toBe(200);
  const bubble = page.getByRole('article', { name: `Tin nhắn đã nhận #${saved.id}`, exact: true });
  await expect(bubble).toContainText('Sinh viên'); expect(await bubble.locator('p').nth(1).textContent()).toBe(content); expect(await bubble.locator('time').getAttribute('datetime')).toBe(saved.createdAt);
  const after = await database(), row = after.messages.find(item => item.id === saved.id);
  expect(after.messageCount).toBe(before.messageCount + 1); expect(row).toMatchObject({ conversation_id: mainId(), sender_user_id: fixture.accounts.student.userId, sender_role: 'STUDENT', content, is_read: false });
  expect(saved.createdAt).toBe(row.created_at.replace(' ', 'T'));
});

test('M04 Company reply, Student reload and SQL preserve chronological identities and recruiting data', async ({ page, request }) => {
  const before = await database(); await signIn(page, 'company'); await openConversation(page, 'recruiter');
  const saved = await sendUi(page, `Phản hồi tổng hợp ${randomUUID()}`); expect(saved.senderRole).toBe('COMPANY'); expect(saved.senderUserId).toBe(fixture.accounts.company.userId); save({ companyMessage: saved.id });
  await logout(page); await signIn(page); await openConversation(page, 'candidate'); await page.reload();
  await expect(page.getByRole('article', { name: `Tin nhắn đã nhận #${saved.id}`, exact: true })).toContainText('Nhà tuyển dụng');
  const ordered = await data(request, 'student', `/conversations/${mainId()}/messages?page=1&size=10`);
  expect(ordered.items.map(row => row.id)).toEqual([required('studentMessage'), saved.id]);
  const after = await database(); expect(after.messageCount).toBe(before.messageCount + 1); expect(rowsFor(after, mainId()).map(row => row.id)).toEqual(ordered.items.map(row => row.id));
  expect(await page.getByRole('article').evaluateAll(elements => elements.map(el => Number(el.getAttribute('aria-label').match(/#(\d+)/)[1])))).toEqual(ordered.items.map(row => row.id));
});

test('M05 Explicit bodyless recipient read is idempotent and never marks outbound or later messages', async ({ page, request }) => {
  let snapshot = await database(); expect(rowsFor(snapshot, mainId()).every(row => !row.is_read)).toBe(true);
  await signIn(page); await openConversation(page, 'candidate'); expect((await readUi(page)).markedCount).toBe(1);
  snapshot = await database(); expect(snapshot.messages.find(row => row.id === required('studentMessage')).is_read).toBe(false); expect(snapshot.messages.find(row => row.id === required('companyMessage')).is_read).toBe(true);
  await expect(page.getByRole('button', { name: 'Đánh dấu đã đọc', exact: true })).toBeEnabled(); expect((await readUi(page)).markedCount).toBe(0);
  const later = await data(request, 'company', `/conversations/${mainId()}/messages`, { method: 'POST', data: { content: randomUUID() } });
  snapshot = await database(); expect(snapshot.messages.find(row => row.id === later.id).is_read).toBe(false);
  await page.getByRole('button', { name: 'Tải lại lịch sử', exact: true }).click(); await expect(page.getByRole('article', { name: `Tin nhắn đã nhận #${later.id}`, exact: true })).toContainText('Chưa đánh dấu đã đọc');
  expect((await readUi(page)).markedCount).toBe(1); snapshot = await database(); expect(snapshot.messages.find(row => row.id === later.id).is_read).toBe(true); expect(snapshot.messages.find(row => row.id === required('studentMessage')).is_read).toBe(false);
});

test('M06 REJECTED/WITHDRAWN Applications retain separate persistent histories without Application mutations', async ({ page, request }) => {
  const before = await database(); await signIn(page); let withdrawnConversation;
  for (const applicationId of [ids.rejectedApplication, ids.withdrawnApplication]) {
    await page.goto(`/candidate/applications/${applicationId}`); const pending = responseFor(page, '/conversations', 'POST');
    await page.getByRole('button', { name: 'Nhắn tin', exact: true }).click(); const response = await pending; expect(response.status()).toBe(200);
    const conversation = (await response.json()).data;
    if (applicationId === ids.rejectedApplication) expect(conversation.id).toBe(ids.deepConversation); else withdrawnConversation = conversation.id;
    await expect(page).toHaveURL(`/candidate/messages/${conversation.id}`);
  }
  expect(withdrawnConversation).not.toBe(ids.deepConversation); const saved = await sendUi(page, randomUUID(), withdrawnConversation);
  await page.reload(); await expect(page.getByRole('article', { name: `Tin nhắn đã gửi #${saved.id}`, exact: true })).toBeVisible();
  await logout(page); await signIn(page, 'company'); await openConversation(page, 'recruiter', withdrawnConversation); await expect(page.getByRole('article', { name: `Tin nhắn đã nhận #${saved.id}`, exact: true })).toBeVisible();
  const historical = await data(request, 'company', `/conversations/${ids.deepConversation}/messages?page=1&size=100`);
  expect(historical.items).toHaveLength(25); expect(historical.items.some(row => row.id === saved.id)).toBe(false);
  const after = await database(); expect(after.conversationCount).toBe(before.conversationCount + 1); expect(after.messageCount).toBe(before.messageCount + 1); save({ withdrawnConversation });
});

test('M07 Owned multi-page metadata deep links and chronological/latest message pages use real bounded APIs', async ({ page, request }) => {
  await signIn(page); const seen = [];
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.startsWith('/api/conversations')) seen.push({ method: request.method(), path: url.pathname, page: url.searchParams.get('page'), size: url.searchParams.get('size') }); });
  await openConversation(page, 'candidate', ids.deepConversation); const expected = rowsFor(await database(), ids.deepConversation);
  expect(new Set(expected.map(row => row.created_at)).size).toBe(1); expect(expected.map(row => row.id)).toEqual([...expected.map(row => row.id)].sort((a, b) => a - b));
  expect(seen.some(row => row.path === '/api/conversations' && row.page === '2' && row.size === '100')).toBe(true);
  for (const row of expected.slice(0, 10)) await expect(page.getByRole('article', { name: `Tin nhắn ${row.sender_role === 'STUDENT' ? 'đã gửi' : 'đã nhận'} #${row.id}`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sau', exact: true }).click(); await expect(page.getByText('Trang 2/3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đến trang mới nhất', exact: true }).click(); await expect(page.getByText('Trang 3/3', { exact: true })).toBeVisible();
  expect(seen.some(row => row.path.endsWith('/messages') && row.page === '3' && row.size === '10')).toBe(true);
  for (const row of expected.slice(20)) await expect(page.getByRole('article', { name: `Tin nhắn ${row.sender_role === 'STUDENT' ? 'đã gửi' : 'đã nhận'} #${row.id}`, exact: true })).toBeVisible();
  expect(seen.every(row => !/^\/api\/conversations\/\d+$/.test(row.path))).toBe(true);
  for (const id of [ids.foreignConversation, 99999999]) {
    await page.goto(`/candidate/messages/${id}`); await expect(page.getByRole('alert')).toContainText('Không tìm thấy');
    await expect(page.getByRole('article')).toHaveCount(0); await expect(page.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true })).toHaveCount(0);
    expect(seen.some(row => row.path === `/api/conversations/${id}/messages`)).toBe(false);
  }
  expect((await api(request, 'student', '/conversations/99999999/messages')).status()).toBe(404); await database();
});

test('M08 Real JWT/RBAC ownership, spoofing and content validation deny private access without writes', async ({ page, request }) => {
  const before = await database(), id = mainId();
  const operations = [['/conversations', { method: 'POST', data: { applicationId: ids.application } }], [`/conversations/${id}/messages`, {}], [`/conversations/${id}/messages`, { method: 'POST', data: { content: randomUUID() } }], [`/conversations/${id}/read`, { method: 'PATCH' }]];
  for (const [route, options] of [['/conversations', {}], ...operations]) expect((await api(request, null, route, options)).status()).toBe(401);
  for (const alias of ['otherCompany', 'otherStudent', 'admin']) {
    for (const [route, options] of operations) expect((await api(request, alias, route, options)).status()).toBe(403);
    if (alias === 'admin') expect((await api(request, alias, '/conversations')).status()).toBe(403);
    else {
      const list = await data(request, alias, '/conversations?page=1&size=100'); expect(list.totalItems).toBe(1); expect(list.items[0].id).toBe(ids.foreignConversation);
      expect(list.items.every(row => row.companyId === ids.otherCompany && row.studentId === ids.otherStudent)).toBe(true);
      expect(JSON.stringify(list)).not.toContain(before.messages.find(row => row.id === required('studentMessage')).content);
    }
  }
  expect((await api(request, 'student', `/companies/me/applications/${ids.application}`)).status()).toBe(403);
  expect((await api(request, 'company', `/students/me/applications/${ids.application}`)).status()).toBe(403);
  for (const content of ['', ' \n\t', 'x'.repeat(5001), 'x' + String.fromCharCode(0)]) expect((await api(request, 'student', `/conversations/${id}/messages`, { method: 'POST', data: { content } })).status()).toBe(400);
  for (const field of ['senderUserId', 'senderRole', 'companyId', 'studentId']) {
    expect((await api(request, 'student', `/conversations/${id}/messages`, { method: 'POST', data: { content: randomUUID(), [field]: 'spoof' } })).status()).toBe(400);
    expect((await api(request, 'company', '/conversations', { method: 'POST', data: { applicationId: ids.application, [field]: 999 } })).status()).toBe(400);
  }
  for (const route of ['/public/companies', '/public/jobs']) {
    const result = await data(request, null, route); const text = JSON.stringify(result);
    for (const field of ['passwordHash', 'verificationDocumentUrl', 'senderUserId', 'filePath', 'storedFileName']) expect(text).not.toContain(field);
    expect(text).not.toContain(before.messages.find(row => row.id === required('studentMessage')).content);
  }
  await signIn(page, 'otherStudent'); await page.goto(`/candidate/messages/${id}`); await expect(page.getByRole('alert')).toContainText('Không tìm thấy');
  await expect(page.getByRole('article')).toHaveCount(0); expect(await page.locator('body').textContent()).not.toContain(before.messages.find(row => row.id === required('studentMessage')).content);
  const after = await database(); expect(after.messageCount).toBe(before.messageCount); expect(after.conversationCount).toBe(before.conversationCount);
});

test('M09 Genuine offline send preserves draft without retry and requires explicit successful latest-history recovery', async ({ page, context }) => {
  const before = await database(), id = mainId(), draft = `Mạng bị ngắt ${randomUUID()}`;
  await signIn(page); await openConversation(page, 'candidate'); const input = page.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true }); await input.fill(draft);
  let posts = 0; page.on('request', request => { if (new URL(request.url()).pathname === `/api/conversations/${id}/messages` && request.method() === 'POST') posts++; });
  try {
    await context.setOffline(true);
    const failed = page.waitForEvent('requestfailed', { predicate: request => new URL(request.url()).pathname === `/api/conversations/${id}/messages` && request.method() === 'POST' });
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click(); expect((await failed).failure()?.errorText).toMatch(/DISCONNECTED|FAILED/i);
    await expect(page.getByRole('alert')).toContainText('Chưa xác nhận được tin nhắn đã gửi'); await expect(input).toHaveValue(draft);
    await expect(page.getByText('Tin nhắn đã được hệ thống xác nhận gửi.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Gửi tin nhắn', exact: true })).toBeDisabled(); await expect(page.getByRole('button', { name: 'Tôi đã kiểm tra lịch sử, cho phép gửi lại', exact: true })).toHaveCount(0);
    await page.waitForTimeout(800); expect(posts).toBe(1);
  } finally { await context.setOffline(false); }
  expect((await database()).messageCount).toBe(before.messageCount);
  const pending = responseFor(page, `/conversations/${id}/messages`); await page.getByRole('button', { name: 'Tải lại lịch sử', exact: true }).click(); expect((await pending).status()).toBe(200);
  await page.getByRole('button', { name: 'Tôi đã kiểm tra lịch sử, cho phép gửi lại', exact: true }).click(); expect(posts).toBe(1); await expect(input).toHaveValue(draft);
  const saved = await sendUi(page, draft); expect(posts).toBe(2); const after = await database(); expect(after.messageCount).toBe(before.messageCount + 1); expect(after.messages.filter(row => row.id === saved.id && row.content === draft)).toHaveLength(1);
  fs.writeFileSync(path.join(local, 'network-failure-summary.json'), JSON.stringify({ genuineChromiumOffline: true, offlineAttemptCommitted: false, automaticRetries: 0, manualResendCommittedOnce: true, afterCommitResponseLossCovered: false }));
});

test('M10 Real locked history GET is cancelled on logout and another account sees only its own data', async ({ page }) => {
  const id = mainId(), draft = randomUUID(); await signIn(page); await openConversation(page, 'candidate');
  await page.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true }).fill(draft);
  const oldRequests = [], failed = new Set(); let capture = true, pendingAtSwitch = [];
  const onRequest = request => { if (capture && new URL(request.url()).pathname === `/api/conversations/${id}/messages` && request.method() === 'GET') oldRequests.push(request); };
  const onFailure = request => { if (oldRequests.includes(request)) failed.add(request); };
  page.on('request', onRequest); page.on('requestfailed', onFailure);
  expect((await control('hold')).held).toBe(true);
  try {
    await page.getByRole('button', { name: 'Tải lại lịch sử', exact: true }).click();
    await expect.poll(async () => (await control('waiters')).waiting, { timeout: 10_000 }).toBeGreaterThan(0);
    pendingAtSwitch = oldRequests.filter(request => !failed.has(request)); expect(pendingAtSwitch.length).toBeGreaterThan(0); capture = false;
    await expect(page.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true })).toHaveValue(draft);
    await logout(page); await expect.poll(() => pendingAtSwitch.some(request => failed.has(request)), { timeout: 5000 }).toBe(true);
    await signIn(page, 'otherStudent'); await page.goto('/candidate/messages');
    await expect(page.getByRole('link', { name: `Hội thoại #${ids.foreignConversation}`, exact: true })).toBeVisible();
    expect((await control('release')).released).toBe(true);
    await expect(page.getByRole('link', { name: `Hội thoại #${id}`, exact: true })).toHaveCount(0);
    expect(await page.locator('body').textContent()).not.toContain(draft); await expect(page.getByRole('textbox', { name: 'Nội dung tin nhắn', exact: true })).toHaveCount(0);
    expect(pendingAtSwitch.some(request => /ABORT|CANCEL|FAILED/i.test(request.failure()?.errorText ?? ''))).toBe(true);
  } finally { page.off('request', onRequest); page.off('requestfailed', onFailure); await control('release'); }
  const snapshot = await database();
  for (const row of rowsFor(snapshot, id)) expect(await page.locator('body').textContent()).not.toContain(row.content);
  fs.writeFileSync(path.join(local, 'session-switch-summary.json'), JSON.stringify({ realPostgresTableLock: true, waitingQueryConfirmed: true, watchdogSeconds: 30, pendingBeforeSwitch: pendingAtSwitch.length, cancelledPendingRequests: pendingAtSwitch.filter(request => failed.has(request)).length, priorDraftAbsent: true, currentAccountOnly: true }));
});
