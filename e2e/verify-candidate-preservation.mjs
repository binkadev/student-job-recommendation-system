import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readLocal, writeLocal } from './helpers.mjs';

// Read-only digests computed inside PostgreSQL; no CV text, notes, JWT or passwords leave it.
const namespace = process.argv.includes('--analytics') ? 'analytics' : 'candidates';
const baseline = readLocal(`${namespace}-baseline.json`);
const studentId = Number(baseline.accounts.student.resourceId), companyId = Number(baseline.accounts.company.resourceId);
assert.ok(Number.isSafeInteger(studentId) && Number.isSafeInteger(companyId));
const cvContent = process.argv.includes('--cv-content');
const queries = [
  ['primaryApplications', `select a.id, md5(to_jsonb(a)::text) digest from applications a where student_id=${studentId}`],
  ['primaryCvs', `select c.id, md5(${cvContent ? "(to_jsonb(c) - 'updated_at')" : 'to_jsonb(c)'}::text) digest from cv_files c where student_id=${studentId}`],
  ['primaryJobs', `select j.id, md5(to_jsonb(j)::text) digest from jobs j where company_id=${companyId}`],
  ['primaryBookmarks', `select s.id, md5(to_jsonb(s)::text) digest from saved_candidates s where company_id=${companyId}`],
  ['primaryRecommendationRuns', `select r.id, md5(to_jsonb(r)::text) digest from recommendation_runs r where student_id=${studentId}`],
  ['primaryRecommendationResults', `select r.id, md5(to_jsonb(r)::text) digest from recommendation_results r join recommendation_runs run on run.id=r.run_id where run.student_id=${studentId}`],
  ['primaryRankingRuns', `select r.id, md5(to_jsonb(r)::text) digest from candidate_ranking_runs r join jobs j on j.id=r.job_id where j.company_id=${companyId}`],
  ['primaryRankingResults', `select r.id, md5(to_jsonb(r)::text) digest from candidate_ranking_results r join candidate_ranking_runs run on run.id=r.run_id join jobs j on j.id=run.job_id where j.company_id=${companyId}`],
];
const sql = 'BEGIN READ ONLY;\n' + queries.map(([key, query]) => `select json_build_object('kind','${key}','rows',coalesce(json_object_agg(id,digest),'{}'::json)) from (${query}) source;`).join('\n') + '\nCOMMIT;';
const result = execFileSync('docker', ['exec', '-i', 'student-job-recommendation-system-postgres-1', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -v ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
const current = Object.fromEntries(result.trim().split(/\r?\n/).map(line => { const row = JSON.parse(line); return [row.kind, row.rows]; }));
// Separate baseline/evidence: never silently reinterpret or overwrite a strict snapshot.
// Existing A03 deliberately changes CV active flags and updated_at, restoring the active CV.
const filename = cvContent ? `${namespace}-db-content-baseline.json` : `${namespace}-db-baseline.json`;
if (process.argv.includes('--capture')) {
  if (namespace === 'analytics') {
    try { readLocal(filename); throw new Error('Do not overwrite the analytics preservation baseline.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  writeLocal(filename, current); console.log('Captured read-only PostgreSQL digests of PRIMARY data and existing V3 history.');
} else {
  const before = readLocal(filename), counts = {}, mismatches = [];
  for (const [kind, rows] of Object.entries(before)) {
    for (const [id, digest] of Object.entries(rows)) if (current[kind][id] !== digest) mismatches.push({ kind, id });
    counts[kind] = { preserved: Object.keys(rows).length - mismatches.filter(row => row.kind === kind).length, changed: mismatches.filter(row => row.kind === kind).length, added: Object.keys(current[kind]).filter(id => !rows[id]).length };
  }
  const evidence = { passed: mismatches.length === 0, cvUpdatedAtExcluded: cvContent, measuredAt: new Date().toISOString(), counts, mismatches };
  writeLocal(cvContent ? `${namespace}-db-content-preservation.json` : `${namespace}-db-preservation.json`, evidence);
  console.log(JSON.stringify(evidence));
  assert.equal(mismatches.length, 0, 'Existing protected rows changed; inspect the explicit evidence.');
}
