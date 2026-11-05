import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { root, writeLocal, readLocal } from './helpers.mjs';

assert.ok(process.argv.includes('--execute-seed'), 'This check executes the seed. Use --execute-seed only when reseeding is explicitly authorized; do not run during read-only handoff.');

// Independent rerun test. This never replaces the original strict preservation
// baseline/comparator. Only task-owned users' authentication timestamps are
// excluded. All pre-existing users (including Admin) must match exactly.
const ownedIds=Object.values(readLocal('manual-final-state.json').accounts).map(a=>a.userId);
assert.ok(ownedIds.every(id=>Number.isSafeInteger(id) && id>0));
function capture() {
  const sql=q=>execFileSync('docker',['exec','-i','student-job-recommendation-system-postgres-1','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -v ON_ERROR_STOP=1'],{input:`BEGIN READ ONLY;\n${q}\nCOMMIT;`,encoding:'utf8'}).trim();
  const tables=JSON.parse(sql("select json_agg(tablename order by tablename) from pg_tables where schemaname='public' and tablename <> 'flyway_schema_history';"));
  const rows={};
  for(const table of tables) {
    assert.match(table,/^[a-z_]+$/);
    const expression=table==='users'?`case when r.id in (${ownedIds.join(',')}) then (to_jsonb(r)-'last_login_at'-'updated_at')::text else row_to_json(r)::text end`:'row_to_json(r)::text';
    rows[table]=JSON.parse(sql(`select coalesce(json_object_agg(r.id,md5(${expression})),'{}'::json) from "${table}" r;`));
  }
  return rows;
}
const before=capture();
execFileSync(process.execPath,[`${root}/manual-final-seed.mjs`],{env:{...process.env,E2E_USE_DEV_SEED_ADMIN:'1'},stdio:'pipe'});
const after=capture();
const result={measuredAt:new Date().toISOString(),passed:JSON.stringify(before)===JSON.stringify(after),tables:Object.keys(before).length,rows:Object.values(before).reduce((n,rows)=>n+Object.keys(rows).length,0),excludedOnlyForThisRerunTest:['task-owned users.last_login_at','task-owned users.updated_at'],oldUsersIncludingAdminExact:true};
writeLocal('manual-final-idempotency.json',result);assert.deepEqual(after,before,'Rerun duplicated data or overwrote manual edits');console.log(JSON.stringify(result));
