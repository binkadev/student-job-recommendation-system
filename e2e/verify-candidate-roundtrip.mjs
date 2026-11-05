import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readLocal, writeLocal, login, ok, api } from './helpers.mjs';

// Run after company-candidates.spec.mjs: reuses its secondary applicant, not PRIMARY.
const fixture = readLocal('candidates-browser-evidence.json').fixtures;
assert.ok(fixture?.applicationIds?.length === 2);
for (const id of [...fixture.applicationIds, fixture.cvId]) assert.ok(Number.isSafeInteger(id) && id > 0);
const token = await login('companyB'), company = await ok('GET', '/companies/me', token);
const source = await ok('GET', `/companies/me/applications/${fixture.applicationIds[0]}`, token);
assert.equal(source.companyId, company.id);
assert.equal(source.cvFileId, fixture.cvId);
assert.equal((await ok('GET', `/companies/me/saved-candidates?studentId=${source.studentId}`, token)).totalItems, 0, 'Do not mutate an existing bookmark');
function sql(query) {
  const result = execFileSync('docker', ['exec', '-i', 'student-job-recommendation-system-postgres-1', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -v ON_ERROR_STOP=1'], { encoding: 'utf8', input: `BEGIN READ ONLY;\n${query};\nCOMMIT;` });
  return JSON.parse(result.trim());
}
const sources = () => sql(`select json_build_object('applications',(select jsonb_object_agg(id,md5(to_jsonb(a)::text)) from applications a where id in (${fixture.applicationIds.join(',')})), 'cv',(select md5(to_jsonb(c)::text) from cv_files c where id=${fixture.cvId}))`);
const before = sources(), steps = [];
let saved;
try {
  saved = await ok('POST', '/companies/me/saved-candidates', token, { applicationId: source.id, note: 'First internal assessment [db-roundtrip]' });
  for (const note of ['First internal assessment [db-roundtrip]', 'Updated internal assessment [db-roundtrip]', null]) {
    if (steps.length) saved = await ok('PATCH', `/companies/me/saved-candidates/${saved.id}/note`, token, { note, revision: saved.revision });
    const row = sql(`select json_build_object('companyId',company_id,'studentId',student_id,'applicationId',application_id,'revision',revision,'noteHash',md5(note)) from saved_candidates where id=${saved.id}`);
    assert.deepEqual(row, { companyId: company.id, studentId: source.studentId, applicationId: source.id, revision: saved.revision, noteHash: note === null ? null : createHash('md5').update(note).digest('hex') });
    // Fresh authenticated request verifies persistence across login, independent of UI memory.
    const fresh = await login('companyB');
    const current = (await ok('GET', `/companies/me/saved-candidates?studentId=${source.studentId}`, fresh)).items[0];
    assert.equal(current.note, note); assert.equal(current.revision, saved.revision);
    steps.push({ operation: steps.length === 0 ? 'save' : note === null ? 'clearNote' : 'updateNote', http: 200, revision: saved.revision, directSqlMatched: true, relogMatched: true });
  }
} finally {
  if (saved) assert.equal((await api('DELETE', `/companies/me/saved-candidates/${saved.id}`, token)).status, 200);
}
assert.equal(sql(`select count(*) from saved_candidates where company_id=${company.id} and student_id=${source.studentId}`), 0);
assert.deepEqual(sources(), before, 'Bookmark/note operations changed an Application or CV');
const evidence = { passed: true, fixtureJobId: fixture.jobId, applicationIds: fixture.applicationIds, cvId: fixture.cvId, steps, unsavedInSql: true, applicationsAndCvByteForByteRowsPreserved: true };
writeLocal('candidates-db-roundtrip.json', evidence); console.log(JSON.stringify(evidence));
