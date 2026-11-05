import assert from 'node:assert/strict';
import { readLocal, writeLocal } from './helpers.mjs';

// Separate additive-schema proof. This does not reinterpret or replace any strict baseline.
const before = readLocal('reliability-before-migration.json');
const after = structuredClone(readLocal('reliability-before-recreate.json'));
const additions = [];
for (const [alias, snapshot] of Object.entries(after)) {
  for (const field of [...(alias.startsWith('company') ? ['account'] : []), 'preferences']) {
    assert.equal(snapshot[field].revision, 0, `${alias}.${field} must initialize at revision 0`);
    assert.equal(Object.hasOwn(before[alias][field], 'revision'), false, 'Expected an actual V20 baseline');
    delete snapshot[field].revision;
    additions.push(`${alias}.${field}.revision`);
  }
}
assert.deepEqual(after, before, 'V21 changed an existing account/preference/inbox/analytics field');
writeLocal('reliability-migration-preservation.json', { passed: true, measuredAt: new Date().toISOString(),
  oldFieldsExactlyPreserved: true, onlyAddedResponseFields: additions, initializedRevision: 0 });
console.log(JSON.stringify({ oldFieldsExactlyPreserved: true, addedRevisionFields: additions.length, initializedRevision: 0 }));
