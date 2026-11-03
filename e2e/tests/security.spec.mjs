import { test, expect } from '@playwright/test';
import { api, apiBase, ok, login, readLocal, writeLocal, credentials } from '../helpers.mjs';

const manifest = readLocal('manifest.json');

test('S01 raw CV streams, run history and foreign mutations remain owner-scoped', async () => {
  const student = await login('student');
  const other = await login('frontend');
  const company = await login('company');
  const otherCompany = await login('companyB');
  const cvId = manifest.cvs.student[0].id;
  const app = (await ok('GET', '/students/me/applications', student))[0];
  const run = (await ok('GET', '/students/me/recommendation-runs', student))[0];
  const checks = [
    await api('GET', `/students/me/cv/${cvId}/file`, other),
    await api('PATCH', `/students/me/cv/${cvId}/active`, other),
    await api('DELETE', `/students/me/cv/${cvId}`, other),
    await api('GET', `/students/me/recommendation-runs/${run.id}`, other),
    await api('PATCH', `/applications/${app.id}/status`, other, { status: 'WITHDRAWN' }),
    await api('GET', `/companies/me/applications/${app.id}/cv/file`, otherCompany),
    await api('GET', `/jobs/${manifest.jobs[10].id}`, otherCompany),
    await api('POST', '/companies/me/saved-candidates', otherCompany, { applicationId: app.id }),
  ];
  checks.forEach(r => { expect([403, 404]).toContain(r.status); expect(r.success).toBe(false); expect(r.data).toBeNull(); });
  // Viewing another company's ACTIVE job is intentionally allowed by /jobs.
  expect((await api('GET', `/jobs/${manifest.jobs[0].id}`, otherCompany)).status).toBe(200);
  const ownedFile = await fetch(`${apiBase}/api/companies/me/applications/${app.id}/cv/file`, { headers: { Authorization: `Bearer ${company}` } });
  expect(ownedFile.status).toBe(200);
  writeLocal('security-evidence.json', { S01: { status: 'PASS', deniedStatuses: checks.map(r => r.status), ownerStream: 200, activeJobReadAllowed: true } });
});

test('S02 password change on secondary account persists and restores without touching primaries', async () => {
  const all = credentials();
  const account = all.incomplete;
  const original = account.password;
  const next = `${original}X`;
  const token = await login('incomplete');
  expect((await api('PATCH', '/users/me/password', token, { currentPassword: 'Wrong-E2e-password!', newPassword: next })).success).toBe(false);
  await ok('PATCH', '/users/me/password', token, { currentPassword: original, newPassword: next });
  account.password = next;
  writeLocal('credentials.json', all);
  try {
    expect((await api('POST', '/auth/login', null, { email: account.email, password: original })).status).toBe(401);
    expect((await ok('GET', '/auth/me', await login('incomplete'))).role).toBe('STUDENT');
  } finally {
    await ok('PATCH', '/users/me/password', await login('incomplete'), { currentPassword: next, newPassword: original });
    account.password = original;
    writeLocal('credentials.json', all);
  }
  expect((await ok('GET', '/auth/me', await login('incomplete'))).role).toBe('STUDENT');
  const evidence = readLocal('security-evidence.json');
  writeLocal('security-evidence.json', { ...evidence, S02: { status: 'PASS', secondaryOnly: true, restored: true } });
});
