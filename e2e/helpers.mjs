import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { accounts, namespace } from './dataset.mjs';

export const root = path.dirname(fileURLToPath(import.meta.url));
export const local = path.join(root, '.local');
fs.mkdirSync(local, { recursive: true });
export const apiBase = process.env.E2E_BACKEND_URL || 'http://localhost:8080';
// This runner creates durable data; never silently target a remote deployment.
for (const url of [apiBase, process.env.E2E_FRONTEND_URL || 'http://localhost:5173']) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('E2E requires localhost');
}
export const readLocal = (name) => JSON.parse(fs.readFileSync(path.join(local, name), 'utf8'));
export const writeLocal = (name, data) => fs.writeFileSync(path.join(local, name), JSON.stringify(data, null, 2), { mode: 0o600 });

export function credentials() {
  const file = path.join(local, 'credentials.json');
  if (!fs.existsSync(file)) {
    writeLocal('credentials.json', Object.fromEntries(Object.entries(accounts).map(([alias, account]) => [alias, {
      ...account, email: `${namespace}.${alias.toLowerCase()}@datn-e2e.invalid`,
      password: `E2e!${randomBytes(24).toString('base64url')}9a`,
    }])));
  }
  return readLocal('credentials.json');
}

export async function api(method, route, token, body) {
  const response = await fetch(`${apiBase}/api${route}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    signal: AbortSignal.timeout(90_000),
  });
  const result = await response.json();
  return { status: response.status, ...result };
}

export async function ok(method, route, token, body) {
  const result = await api(method, route, token, body);
  if (result.status >= 400 || !result.success) throw new Error(`${method} ${route}: HTTP ${result.status} ${result.errorCode ?? ''}`);
  return result.data;
}

export async function login(alias) {
  const { email, password } = credentials()[alias];
  return (await ok('POST', '/auth/login', null, { email, password })).token;
}

export async function devAdmin() {
  // Explicit opt-in; existing dev account only. Never register/escalate an ADMIN.
  if (process.env.E2E_USE_DEV_SEED_ADMIN !== '1') return null;
  const seed = fs.readFileSync(path.join(root, '../backend/src/main/java/com/tttn/jobrecommendation/infrastructure/seed/DataSeeder.java'), 'utf8');
  const email = seed.match(/ensureUser\("([^"]+)",\s*"Demo Admin"/)?.[1];
  const password = seed.match(/DEMO_PASSWORD\s*=\s*"([^"]+)"/)?.[1];
  if (!email || !password) return null;
  const result = await api('POST', '/auth/login', null, { email, password });
  return result.success && result.data.user.role === 'ADMIN' ? result.data.token : null;
}

export async function upload(token, filename, active = false) {
  const form = new FormData();
  const contentType = filename.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  form.append('file', new Blob([fs.readFileSync(path.join(local, filename))], { type: contentType }), filename);
  return ok('POST', `/students/me/cv?active=${active}`, token, form);
}
