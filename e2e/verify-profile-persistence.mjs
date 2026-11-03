import { ok, login, readLocal, writeLocal } from './helpers.mjs';

// Read-only API checks. Run --capture before recreating ONLY Backend, then rerun
// without arguments. Version/timestamps and complete aggregate payload must survive.
const aliases = ['student', 'studentUi'];
const snapshots = {};
for (const alias of aliases) snapshots[alias] = await ok('GET', '/students/me/profile-aggregate', await login(alias));
if (process.argv.includes('--capture')) {
  writeLocal('profile-before-recreate.json', snapshots);
  console.log('Captured two aggregate snapshots locally; credentials excluded.');
} else {
  const before = readLocal('profile-before-recreate.json');
  for (const alias of aliases) if (JSON.stringify(snapshots[alias]) !== JSON.stringify(before[alias])) throw new Error(`Aggregate persistence mismatch for ${alias}; inspect local snapshots.`);
  writeLocal('profile-persistence-evidence.json', { measuredAt: new Date().toISOString(), aliases, exactSnapshotsPreserved: true, revisions: Object.fromEntries(aliases.map(alias => [alias, snapshots[alias].revision])) });
  console.log('PASS: both complete aggregate snapshots, revisions and timestamps survived Backend recreate.');
}
const contentOnly = value => JSON.stringify(value, (key, item) => ['createdAt', 'updatedAt', 'profileEtag'].includes(key) ? undefined : item);
const primaryBefore = readLocal('profile-primary-content-baseline.json');
for (const field of ['student', 'profile', 'skills']) {
  if (contentOnly(snapshots.student[field]) !== contentOnly(primaryBefore[field])) throw new Error(`PRIMARY ${field} content changed; inspect local baseline.`);
}
console.log('PASS: PRIMARY basic/profile/skills content matches pre-task baseline (timestamps excluded).');
