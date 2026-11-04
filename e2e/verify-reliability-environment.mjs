import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readLocal, writeLocal } from './helpers.mjs';
const inspect = (...args) => JSON.parse(execFileSync('docker', args, { encoding: 'utf8' }));
const volumes = inspect('volume', 'inspect', 'student-job-recommendation-system_postgres_data', 'student-job-recommendation-system_cv_uploads')
  .map(v => ({ name: v.Name, createdAt: v.CreatedAt, driver: v.Driver }));
assert.deepEqual(volumes, readLocal('reliability-volumes-baseline.json'));
const services = inspect('inspect', 'student-job-recommendation-system-postgres-1', 'student-job-recommendation-system-ai-service-1');
assert.ok(services.every(v => v.State.Running && v.State.Health?.Status === 'healthy'));
assert.deepEqual(services.map(v => ({ name: v.Name, id: v.Id, image: v.Image, startedAt: v.State.StartedAt })), readLocal('reliability-demo-services-baseline.json'));
const sql = `BEGIN READ ONLY;
select json_build_object('version',max(version::int),'applied',count(*),'allSuccessful',bool_and(success)) from flyway_schema_history where version is not null;
COMMIT;`;
const raw = execFileSync('docker', ['exec', '-i', 'student-job-recommendation-system-postgres-1', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -v ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
const migration = JSON.parse(raw.trim());
assert.deepEqual(migration, { version: 21, applied: 21, allSuccessful: true });
const evidence = { measuredAt: new Date().toISOString(), namedVolumesExactlyPreserved: true,
  demoPostgresAndAiNotReplacedOrRestarted: true, healthy: true, migration };
writeLocal('reliability-environment-preservation.json', evidence);
console.log(JSON.stringify(evidence));
