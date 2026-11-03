import assert from 'node:assert/strict';
import { readLocal, writeLocal } from './helpers.mjs';

// Read-only comparison. Call summarize-state before and after the controlled run.
// Baseline remains local because account/resource inventories are environment-specific.
const before = readLocal(process.argv[2] || 'p0-moderation-baseline.json');
const after = readLocal(process.argv[3] || 'final-state.json');
for (const [alias, account] of Object.entries(before.accounts)) {
  const current = after.accounts[alias];
  assert.ok(current, `Existing alias missing: ${alias}`);
  for (const field of ['userId', 'role', 'resourceId', 'status']) assert.deepEqual(current[field], account[field], `${alias}.${field}`);
  for (const cv of account.cvs ?? []) assert.deepEqual(current.cvs.find(c => c.id === cv.id), cv, `${alias} existing CV ${cv.id}`);
}
for (const job of before.jobs) assert.deepEqual(after.jobs.find(j => j.id === job.id), job, `Primary Company job ${job.id}`);
for (const application of before.accounts.student.applications) {
  assert.deepEqual(after.accounts.student.applications.find(a => a.id === application.id), application, `Primary Student application ${application.id}`);
}
const result = {
  baselineAt: before.measuredAt, checkedAt: after.measuredAt,
  preservedAliases: Object.keys(before.accounts).length,
  existingCvs: Object.values(before.accounts).reduce((n, a) => n + (a.cvs?.length ?? 0), 0),
  primaryCompanyJobs: before.jobs.length,
  primaryStudentApplications: before.accounts.student.applications.length,
  addedAliases: Object.keys(after.accounts).filter(alias => !before.accounts[alias]),
  statisticsBefore: before.statistics, statisticsAfter: after.statistics,
};
writeLocal('p0-preservation-evidence.json', result);
console.log(JSON.stringify(result));
