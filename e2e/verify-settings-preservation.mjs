import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { login, ok, readLocal, writeLocal } from './helpers.mjs';

const namespace = process.argv.includes('--analytics') ? 'analytics' : 'settings';
const baseline = readLocal(namespace === 'analytics' ? 'analytics-baseline.json' : 'settings-notifications-baseline.json');
const ids = ['student', 'company'].map(alias => Number(baseline.accounts[alias].userId));
assert.ok(ids.every(id => Number.isSafeInteger(id) && id > 0));
const studentId = Number(baseline.accounts.student.resourceId), companyId = Number(baseline.accounts.company.resourceId);
assert.ok([studentId, companyId].every(id => Number.isSafeInteger(id) && id > 0));
const queries = [
  ['primaryIdentityAndPassword', `select id, md5((to_jsonb(u) - 'last_login_at' - 'updated_at')::text) digest from users u where id in (${ids.join(',')})`],
  ['primaryPreferences', `select user_id id, md5((to_jsonb(s) - 'updated_at')::text) digest from user_notification_settings s where user_id in (${ids.join(',')})`],
  ['primaryApplications', `select a.id, md5(to_jsonb(a)::text) digest from applications a where student_id=${studentId}`],
  ['primaryCvs', `select c.id, md5(to_jsonb(c)::text) digest from cv_files c where student_id=${studentId}`],
  ['primaryCvsContent', `select c.id, md5((to_jsonb(c) - 'updated_at')::text) digest from cv_files c where student_id=${studentId}`],
  ['primaryJobs', `select j.id, md5(to_jsonb(j)::text) digest from jobs j where company_id=${companyId}`],
  ['primaryBookmarks', `select s.id, md5(to_jsonb(s)::text) digest from saved_candidates s where company_id=${companyId}`],
  ['primaryRecommendationRuns', `select r.id, md5(to_jsonb(r)::text) digest from recommendation_runs r where student_id=${studentId}`],
  ['primaryRecommendationResults', `select r.id, md5(to_jsonb(r)::text) digest from recommendation_results r join recommendation_runs run on run.id=r.run_id where run.student_id=${studentId}`],
  ['primaryRankingRuns', `select r.id, md5(to_jsonb(r)::text) digest from candidate_ranking_runs r join jobs j on j.id=r.job_id where j.company_id=${companyId}`],
  ['primaryRankingResults', `select r.id, md5(to_jsonb(r)::text) digest from candidate_ranking_results r join candidate_ranking_runs run on run.id=r.run_id join jobs j on j.id=run.job_id where j.company_id=${companyId}`],
];
const sql = 'BEGIN READ ONLY;\n' + queries.map(([kind, query]) => `select json_build_object('kind','${kind}','rows',coalesce(json_object_agg(id,digest),'{}'::json)) from (${query}) source;`).join('\n') + '\nCOMMIT;';
const raw = execFileSync('docker', ['exec', '-i', 'student-job-recommendation-system-postgres-1', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -v ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
const digests = Object.fromEntries(raw.trim().split(/\r?\n/).map(line => { const row = JSON.parse(line); return [row.kind, row.rows]; }));
const profile = await ok('GET', '/students/me/profile-aggregate', await login('student'));
function content(value) {
  if (Array.isArray(value)) return value.map(content);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['revision', 'profileRevision', 'updatedAt', 'createdAt'].includes(key)).map(([key, item]) => [key, content(item)]));
  return value;
}
const current = { digests, profile: content(profile) };
const filename = `${namespace}-security-content-baseline.json`;
if (process.argv.includes('--capture')) {
  // Never silently replace a baseline during a work package.
  try { readLocal(filename); throw new Error('Settings baseline already exists; choose a new work-package namespace.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  writeLocal(filename, { ...current, digests: { primaryIdentityAndPassword: digests.primaryIdentityAndPassword, primaryPreferences: digests.primaryPreferences } });
  console.log('Captured PRIMARY identity/password/preferences digests and profile content (no sensitive values printed).');
} else {
  const before = readLocal(filename);
  const checks = Object.fromEntries(Object.keys(before.digests).map(key => [key, JSON.stringify(before.digests[key]) === JSON.stringify(current.digests[key])]));
  checks.primaryProfileContent = JSON.stringify(before.profile) === JSON.stringify(current.profile);
  writeLocal(`${namespace}-security-preservation.json`, { checkedAt: new Date().toISOString(), checks });
  console.log(JSON.stringify(checks));
  assert.ok(Object.values(checks).every(Boolean), 'PRIMARY content changed; inspect local evidence.');
  function compareRows(beforeRows, contentOnly) {
    const mismatches = [], counts = {};
    for (const [kind, rows] of Object.entries(beforeRows)) {
      const after = digests[contentOnly && kind === 'primaryCvs' ? 'primaryCvsContent' : kind];
      for (const [id, digest] of Object.entries(rows)) if (after[id] !== digest) mismatches.push({ kind, id });
      counts[kind] = { baseline: Object.keys(rows).length, changed: mismatches.filter(row => row.kind === kind).length,
        added: Object.keys(after).filter(id => !rows[id]).length };
    }
    return { passed: mismatches.length === 0, counts, mismatches };
  }
  const strict = compareRows(readLocal(`${namespace}-db-baseline.json`), false);
  const cvContent = compareRows(readLocal(`${namespace}-db-content-baseline.json`), true);
  writeLocal(`${namespace}-row-preservation.json`, { checkedAt: new Date().toISOString(), strict, cvContent });
  console.log(JSON.stringify({ strict, cvContent }));
  assert.ok(cvContent.passed, 'Protected content or history changed; inspect row evidence.');
  assert.ok(strict.mismatches.every(row => row.kind === 'primaryCvs'), 'Unexpected strict mismatch outside CV timestamps.');
}
