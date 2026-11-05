import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { local, readLocal, writeLocal } from './helpers.mjs';

// Separate checkpoint: never replaces or relaxes the historical comparator.
const sql = query => execFileSync('docker', ['exec', '-i', 'student-job-recommendation-system-postgres-1', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -v ON_ERROR_STOP=1'], { input: `BEGIN READ ONLY;\n${query};\nCOMMIT;`, encoding: 'utf8' }).trim();
const tables = JSON.parse(sql("select json_agg(tablename order by tablename) from pg_tables where schemaname='public' and tablename <> 'flyway_schema_history'"));
const rows = {}, content = {};
for (const table of tables) {
  assert.match(table, /^[a-z_]+$/);
  rows[table] = JSON.parse(sql(`select coalesce(json_object_agg(r.id,md5(row_to_json(r)::text)),'{}'::json) from "${table}" r`));
  content[table] = table === 'users' ? JSON.parse(sql(`select coalesce(json_object_agg(r.id,md5((to_jsonb(r)-'last_login_at'-'updated_at')::text)),'{}'::json) from users r`)) : rows[table];
}
const volumes = JSON.parse(execFileSync('docker', ['volume', 'inspect', 'student-job-recommendation-system_postgres_data', 'student-job-recommendation-system_cv_uploads'], { encoding: 'utf8' })).map(v => ({ name: v.Name, createdAt: v.CreatedAt }));
const baseline = 'neo-aurora-baseline.json';
if (process.argv.includes('--baseline')) {
  assert.ok(!fs.existsSync(`${local}/${baseline}`), 'Never overwrite an existing checkpoint');
  writeLocal(baseline, { measuredAt: new Date().toISOString(), rows, content, volumes });
  console.log(JSON.stringify({ baseline: true, tables: tables.length, rows: Object.values(rows).reduce((n, r) => n + Object.keys(r).length, 0) }));
} else {
  const before = readLocal(baseline);
  function compare(previous, current) {
    const differences = [];
    for (const table of new Set([...Object.keys(previous), ...Object.keys(current)]))
      for (const id of new Set([...Object.keys(previous[table] ?? {}), ...Object.keys(current[table] ?? {})]))
        if (previous[table]?.[id] !== current[table]?.[id]) differences.push({ table, id });
    return differences;
  }
  const evidence = { measuredAt: new Date().toISOString(), fullRowChanges: compare(before.rows, rows), contentChanges: compare(before.content, content), volumesPreserved: JSON.stringify(before.volumes) === JSON.stringify(volumes) };
  writeLocal('neo-aurora-preservation.json', evidence);
  console.log(JSON.stringify(evidence));
  assert.deepEqual(evidence.contentChanges, []);
  assert.ok(evidence.volumesPreserved);
}
