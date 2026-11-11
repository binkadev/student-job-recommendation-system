import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// Deliberately independent of helpers/dataset that can use manual demo credentials.
const fixturePath = process.env.COMPANY_VERIFICATION_FIXTURE;
if (!fixturePath) throw new Error('Dedicated isolated runner required');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(fixture.backendUrl)) throw new Error('Disposable loopback Backend required');
const local = path.dirname(fixturePath);
const ownerId = fixture.accounts.company.companyId;
const documentRoute = '/companies/me/verification-document';
const adminRoute = `/admin/companies/${ownerId}/verification-document`;
const tokens = new Map();
const png = fs.readFileSync(path.join(local, 'replacement.png'));
function makePdf() {
  let content = '%PDF-1.4\n';
  const offsets = [0];
  for (const [i, object] of ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] >>'].entries()) {
    offsets.push(Buffer.byteLength(content)); content += `${i + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(content);
  content += 'xref\n0 4\n0000000000 65535 f \n' + offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
  return Buffer.from(content + `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
const pdf = makePdf();
fs.writeFileSync(path.join(local, 'synthetic.pdf'), pdf);
const evidence = { realHttp: true, backendMocked: false, aiMocked: false, postgresImage: fixture.postgresImage, cases: {} };

test.afterEach(async ({}, info) => {
  evidence.cases[info.title] = info.status;
  fs.writeFileSync(path.join(local, 'evidence.json'), JSON.stringify(evidence, null, 2));
});
async function api(request, alias, route, options = {}) {
  if (alias && !tokens.has(alias)) {
    const login = await request.post(`${fixture.backendUrl}/api/auth/login`, { data: { email: fixture.accounts[alias].email, password: fixture.accounts[alias].password } });
    if (login.status() !== 200) throw new Error(`Synthetic ${alias} login failed`);
    const data = (await login.json()).data;
    if (!data.token) throw new Error('Synthetic login token missing');
    tokens.set(alias, data.token);
  }
  return request.fetch(`${fixture.backendUrl}/api${route}`, { ...options, headers: { ...(alias ? { Authorization: `Bearer ${tokens.get(alias)}` } : {}), ...options.headers } });
}
async function data(request, alias, route) {
  const response = await api(request, alias, route); expect(response.status()).toBe(200);
  return { value: (await response.json()).data, etag: response.headers().etag };
}
async function signIn(page, alias = 'company') {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill(fixture.accounts[alias].email);
  await page.locator('input[name="password"]').fill(fixture.accounts[alias].password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(alias === 'admin' ? '/admin/dashboard' : '/recruiter/dashboard');
}
function responseFor(page, route, method = 'GET') {
  return page.waitForResponse(r => new URL(r.url()).pathname === `/api${route}` && r.request().method() === method);
}
async function openDocument(page) {
  const loaded = responseFor(page, documentRoute);
  await page.goto('/recruiter/company/verification');
  expect((await loaded).status()).toBe(200);
  await expect(page.getByLabel('Chọn tài liệu xác thực')).toBeEnabled();
}
async function uploadUi(page, bytes, name, mimeType) {
  await page.getByLabel('Chọn tài liệu xác thực').setInputFiles({ name, mimeType, buffer: bytes });
  const upload = responseFor(page, documentRoute, 'PUT');
  const profileRefresh = responseFor(page, '/companies/me');
  const statusRefresh = responseFor(page, documentRoute);
  await page.getByRole('button', { name: /^(Gửi tài liệu xác thực|Thay thế tài liệu)$/ }).click();
  const response = await upload; expect(response.status()).toBe(200);
  expect(response.request().headers()['content-type']).toMatch(/^multipart\/form-data; boundary=/);
  // Chromium omits file-backed multipart bytes from Request.postDataBuffer().
  // The real endpoint enforces the single file part; storage/download checks verify its bytes.
  expect(response.request().headers()['if-match']).toMatch(/^"\d+"$/);
  const saved = (await response.json()).data;
  expect((await (await statusRefresh).json()).data).toEqual(saved);
  expect((await (await profileRefresh).json()).data.revision).toBe(saved.revision);
  await expect(page.getByText('Đã gửi tài liệu xác thực.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tải tài liệu xác thực', exact: true })).toBeEnabled();
  return saved;
}
async function downloadUi(page, route, bytes) {
  const http = responseFor(page, `${route}/file`);
  const transfer = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Tải tài liệu xác thực', exact: true }).click();
  const response = await http; expect(response.status()).toBe(200);
  expect(Boolean(response.request().headers().authorization?.startsWith('Bearer '))).toBe(true);
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  const downloaded = await transfer;
  const stream = await downloaded.createReadStream(); const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).equals(bytes)).toBe(true);
  await expect(page.locator('a[href*="verification-document"], iframe, embed')).toHaveCount(0);
}
function privateFiles() { return fs.readdirSync(fixture.privateStorage); }
async function noLeak(page, request, expectedDetailStatus = 404) {
  const keys = privateFiles();
  const rendered = await page.content();
  expect(rendered.includes(fixture.privateStorage)).toBe(false);
  for (const key of keys) expect(rendered.includes(key)).toBe(false);
  for (const route of ['/public/companies', `/public/companies/${ownerId}`]) {
    const response = await api(request, null, route);
    expect(response.status()).toBe(route === '/public/companies' ? 200 : expectedDetailStatus);
    const body = await response.text();
    expect(/verificationDocument|verification_document|submitted|storageKey|private-documents/i.test(body)).toBe(false);
    expect(body.includes(fixture.privateStorage)).toBe(false);
    for (const key of keys) expect(body.includes(key)).toBe(false);
  }
}

test('B3-01 Company profile saves/clears media with If-Match and preserves other data', async ({ page, request }) => {
  await signIn(page);
  const before = await data(request, 'company', '/companies/me');
  const logo = `${process.env.COMPANY_VERIFICATION_FRONTEND}/company-media/logo.png`;
  const cover = `${process.env.COMPANY_VERIFICATION_FRONTEND}/company-media/cover.png`;
  // Image delivery only; all /api traffic reaches the real Backend.
  await page.route('**/company-media/*.png', r => r.fulfill({ contentType: 'image/png', body: png }));
  await page.goto('/recruiter/company/edit');
  await expect(page.getByLabel('Tên công ty', { exact: true })).toHaveValue(before.value.companyName);
  await page.getByLabel('Quy mô công ty', { exact: true }).fill('51–100 nhân viên');
  await page.getByLabel('URL logo', { exact: true }).fill(logo);
  await page.getByLabel('URL ảnh bìa', { exact: true }).fill(cover);
  const savedResponse = responseFor(page, '/companies/me', 'PUT');
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  const saved = await savedResponse; expect(saved.status()).toBe(200);
  expect(saved.request().headers()['if-match']).toBe(before.etag);
  await expect(page.getByText('Đã lưu hồ sơ công ty', { exact: true })).toBeVisible();
  await page.goto('/recruiter/company');
  await page.reload();
  await expect(page.locator('.neo-company-hero img')).toHaveCount(2);
  await expect(page.locator(`img[src="${cover}"]`)).toHaveAttribute('referrerpolicy', 'no-referrer');
  await page.unroute('**/company-media/*.png');
  await page.route('**/company-media/*.png', r => r.abort());
  await page.reload();
  await expect(page.locator('.neo-company-hero img')).toHaveCount(0);
  await expect(page.getByRole('img', { name: `Logo mặc định của ${before.value.companyName}` })).toBeVisible();
  await page.goto('/recruiter/company/edit');
  await expect(page.getByLabel('URL logo', { exact: true })).toHaveValue(logo);
  await expect(page.getByLabel('URL ảnh bìa', { exact: true })).toHaveValue(cover);
  await expect(page.getByLabel('Quy mô công ty', { exact: true })).toHaveValue('51–100 nhân viên');
  await page.getByLabel('URL logo', { exact: true }).fill('');
  await page.getByLabel('URL ảnh bìa', { exact: true }).fill('');
  const cleared = responseFor(page, '/companies/me', 'PUT');
  await page.getByRole('button', { name: 'Lưu hồ sơ', exact: true }).click();
  expect((await cleared).status()).toBe(200);
  await expect(page.getByText('Đã lưu hồ sơ công ty', { exact: true })).toBeVisible();
  await page.goto('/recruiter/company'); await page.reload();
  await expect(page.locator('.neo-company-hero img')).toHaveCount(0);
  const after = (await data(request, 'company', '/companies/me')).value;
  expect(after.logoUrl).toBeNull(); expect(after.coverImageUrl).toBeNull();
  expect(after.companySize).toBe('51–100 nhân viên');
  for (const field of ['companyName', 'description', 'address', 'phone', 'industry', 'taxCode', 'status']) expect(after[field]).toEqual(before.value[field]);
});

test('B3-02 Initial private PDF submission refreshes revision and downloads exact bytes', async ({ page, request }) => {
  await signIn(page); await openDocument(page);
  await expect(page.getByText('Chưa gửi tài liệu xác thực.', { exact: true })).toBeVisible();
  const before = await data(request, 'company', documentRoute);
  expect(before.value.submitted).toBe(false);
  const saved = await uploadUi(page, pdf, 'synthetic.pdf', 'application/pdf');
  expect(saved.revision).toBe(before.value.revision + 1);
  expect((await data(request, 'company', '/companies/me')).value.status).toBe('PENDING');
  expect(privateFiles()).toHaveLength(1);
  expect(fs.readFileSync(path.join(fixture.privateStorage, privateFiles()[0])).equals(pdf)).toBe(true);
  await downloadUi(page, documentRoute, pdf);
});

test('B3-03 PNG replacement returns new bytes, cleans prior file and leaks no key', async ({ page, request }) => {
  await signIn(page); await openDocument(page);
  const oldKeys = privateFiles(); expect(oldKeys).toHaveLength(1);
  const before = await data(request, 'company', documentRoute);
  const saved = await uploadUi(page, png, 'replacement.png', 'image/png');
  expect(saved.revision).toBe(before.value.revision + 1);
  await expect.poll(privateFiles).toHaveLength(1);
  expect(privateFiles()[0] === oldKeys[0]).toBe(false);
  expect(fs.existsSync(path.join(fixture.privateStorage, oldKeys[0]))).toBe(false);
  await downloadUi(page, documentRoute, png); await noLeak(page, request);
  expect((await data(request, 'company', '/companies/me')).value.status).toBe('PENDING');
});

test('B3-04 Stale upload gets 409, retains file without retry; manual reload gets current ETag', async ({ page, request }) => {
  await signIn(page); await openDocument(page);
  const captured = await data(request, 'company', documentRoute);
  const changed = await api(request, 'company', '/companies/me', { method: 'PUT', headers: { 'If-Match': captured.etag }, data: { companySize: '101–200 nhân viên' } });
  expect(changed.status()).toBe(200);
  const current = await data(request, 'company', documentRoute);
  expect(current.value.revision).toBe(captured.value.revision + 1);
  let writes = 0;
  page.on('request', r => { if (new URL(r.url()).pathname === `/api${documentRoute}` && r.method() === 'PUT') writes++; });
  const keys = privateFiles();
  await page.getByLabel('Chọn tài liệu xác thực').setInputFiles({ name: 'stale.pdf', mimeType: 'application/pdf', buffer: pdf });
  const rejected = responseFor(page, documentRoute, 'PUT');
  await page.getByRole('button', { name: 'Thay thế tài liệu', exact: true }).click();
  const conflict = await rejected; expect(conflict.status()).toBe(409);
  expect(conflict.request().headers()['if-match']).toBe(captured.etag);
  await expect(page.getByRole('alert').filter({ hasText: 'Hồ sơ đã thay đổi' })).toBeVisible();
  expect(await page.getByLabel('Chọn tài liệu xác thực').evaluate(el => el.files[0]?.name)).toBe('stale.pdf');
  await expect(page.getByRole('button', { name: 'Thay thế tài liệu', exact: true })).toBeDisabled();
  await page.waitForTimeout(1000); expect(writes).toBe(1);
  expect(privateFiles()).toEqual(keys);
  const reloaded = responseFor(page, documentRoute); await page.reload();
  expect((await reloaded).headers().etag).toBe(current.etag);
  await expect(page.getByLabel('Chọn tài liệu xác thực')).toBeEnabled();
  expect(await page.getByLabel('Chọn tài liệu xác thực').evaluate(el => el.files.length)).toBe(0);
});

test('B3-05 Admin downloads private submission and manually verifies the still-pending owner', async ({ page, request }) => {
  expect((await data(request, 'company', '/companies/me')).value.status).toBe('PENDING');
  await signIn(page, 'admin');
  await page.goto(`/admin/companies/${fixture.accounts.otherCompany.companyId}/verification`);
  await expect(page.getByText('Chưa gửi tài liệu xác thực.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tải tài liệu xác thực', exact: true })).toHaveCount(0);
  await page.goto(`/admin/companies/${ownerId}/verification`);
  await expect(page.getByText('Đã gửi tài liệu xác thực.', { exact: true })).toBeVisible();
  await expect(page.getByText('Chờ xác thực', { exact: true }).last()).toBeVisible();
  await downloadUi(page, adminRoute, png); await noLeak(page, request);
  await page.goto('/admin/companies');
  const row = page.getByRole('row').filter({ hasText: 'Isolated company' });
  await row.getByRole('button', { name: 'Trạng thái', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Trạng thái', { exact: true }).selectOption('VERIFIED');
  const changed = responseFor(page, `/admin/companies/${ownerId}/status`, 'PATCH');
  await modal.getByRole('button', { name: 'Cập nhật', exact: true }).click();
  expect((await changed).status()).toBe(200);
  expect((await data(request, 'company', '/companies/me')).value.status).toBe('VERIFIED');
  const publicDetail = await api(request, null, `/public/companies/${ownerId}`);
  expect(publicDetail.status()).toBe(200);
});

test('B3-06 Role/owner boundaries and public/listing metadata isolation', async ({ page, request }) => {
  const protectedRoutes = [documentRoute, `${documentRoute}/file`, adminRoute, `${adminRoute}/file`];
  for (const route of protectedRoutes) {
    expect([401, 403]).toContain((await api(request, null, route)).status());
    expect((await api(request, 'student', route)).status()).toBe(403);
  }
  for (const alias of ['company', 'otherCompany']) {
    expect((await api(request, alias, adminRoute)).status()).toBe(403);
    expect((await api(request, alias, `${adminRoute}/file`)).status()).toBe(403);
  }
  const other = await data(request, 'otherCompany', documentRoute);
  expect(other.value.submitted).toBe(false);
  expect((await api(request, 'otherCompany', `${documentRoute}/file`)).status()).toBe(404);
  expect((await api(request, 'admin', documentRoute)).status()).toBe(403);
  expect((await api(request, 'admin', `${documentRoute}/file`)).status()).toBe(403);
  await signIn(page); await openDocument(page); await noLeak(page, request, 200);
  for (const route of [`/admin/companies/${ownerId}`, '/admin/companies']) {
    const result = await api(request, 'admin', route); expect(result.status()).toBe(200);
    const body = await result.text();
    expect(/verificationDocument|verification_document|submitted|storageKey|private-documents/i.test(body)).toBe(false);
    for (const key of privateFiles()) expect(body.includes(key)).toBe(false);
  }
  const status = await data(request, 'company', documentRoute);
  expect(Object.keys(status.value).sort()).toEqual(['revision', 'submitted']);
  expect(status.value.submitted).toBe(true);
  expect(status.etag).toBe(`"${status.value.revision}"`);
});
