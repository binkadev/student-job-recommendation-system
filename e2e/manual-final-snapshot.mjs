import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { local, writeLocal, readLocal } from './helpers.mjs';

// READ ONLY: hashes cover every original row, including timestamps and private
// fields, without exporting passwords, CV text or personal data to the report.
const sql = q => execFileSync('docker', ['exec', '-i', 'student-job-recommendation-system-postgres-1', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -v ON_ERROR_STOP=1'], { input: `BEGIN READ ONLY;\n${q}\nCOMMIT;`, encoding: 'utf8' }).trim();
const tables = JSON.parse(sql("select json_agg(tablename order by tablename) from pg_tables where schemaname='public' and tablename <> 'flyway_schema_history';"));
const rows = {};
for (const table of tables) {
  assert.match(table, /^[a-z_]+$/);
  rows[table] = JSON.parse(sql(`select coalesce(json_object_agg(r.id,md5(row_to_json(r)::text)),'{}'::json) from "${table}" r;`));
}
const volumes = JSON.parse(execFileSync('docker', ['volume', 'inspect', 'student-job-recommendation-system_postgres_data', 'student-job-recommendation-system_cv_uploads'], { encoding: 'utf8' })).map(v => ({ name: v.Name, createdAt: v.CreatedAt }));
if (process.argv.includes('--baseline')) {
  assert.ok(!fs.existsSync(`${local}/manual-final-baseline.json`), 'Baseline already exists; never replace it');
  writeLocal('manual-final-baseline.json', { measuredAt: new Date().toISOString(), rows, volumes });
  console.log(JSON.stringify({ baseline: true, tables: tables.length, rows: Object.values(rows).reduce((n,v)=>n+Object.keys(v).length,0) }));
} else {
  const before = readLocal('manual-final-baseline.json');
  const mismatches = [], additions = {};
  for (const [table, old] of Object.entries(before.rows)) {
    for (const [id, hash] of Object.entries(old)) if (rows[table][id] !== hash) mismatches.push({ table, id, missing: !rows[table][id] });
    additions[table] = Object.keys(rows[table]).filter(id => !Object.hasOwn(old,id)).length;
  }
  const evidence = { measuredAt: new Date().toISOString(), mismatches, additions, volumesPreserved: JSON.stringify(before.volumes) === JSON.stringify(volumes) };
  writeLocal('manual-final-preservation.json', evidence);
  console.log(JSON.stringify(evidence));
  assert.deepEqual(mismatches, [], 'Strict original-row preservation failed');
  assert.deepEqual(volumes, before.volumes);
}
