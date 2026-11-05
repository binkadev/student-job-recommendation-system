import assert from 'node:assert/strict';
import { login, ok, readLocal, writeLocal } from './helpers.mjs';

// Read-only. Capture this package's PRIMARY aggregate before running mutations;
// summarize-state + verify-preservation cover the remaining durable fixtures.
const name = 'own-jobs-primary-profile-baseline.json';
const current = await ok('GET', '/students/me/profile-aggregate', await login('student'));
if (process.argv.includes('--capture')) {
  writeLocal(name, current);
  console.log('Captured PRIMARY aggregate baseline locally; no database writes.');
} else {
  const baseline = readLocal(name);
  const content = value => Array.isArray(value) ? value.map(content)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)
      .filter(([key]) => !['revision', 'createdAt', 'updatedAt'].includes(key)).map(([key, field]) => [key, content(field)])) : value;
  assert.deepEqual(content(current), content(baseline), 'PRIMARY profile content changed');
  const token = await login('companyB');
  const company = await ok('GET', '/companies/me', token);
  const data = await ok('GET', `/companies/me/jobs?keyword=${encodeURIComponent('Own paging draft [p1-e2e]')}&size=100`, token);
  assert.equal(data.totalItems, 1, 'Expected one bounded owned-job fixture');
  const draft = await ok('GET', `/jobs/${data.items[0].id}`, token);
  assert.equal(draft.companyId, company.id); assert.equal(draft.status, 'DRAFT');
  assert.equal(draft.benefits, 'Read-back of a dedicated secondary owned-job draft.');
  const result = { primaryContentPreserved: true, revisionBefore: baseline.revision, revisionAfter: current.revision,
    secondaryDraft: { id: draft.id, companyId: draft.companyId, status: draft.status, benefitsPersisted: true } };
  writeLocal('own-jobs-profile-preservation.json', result);
  console.log(JSON.stringify(result));
}
