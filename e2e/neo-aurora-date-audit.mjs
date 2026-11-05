import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readLocal, writeLocal } from './helpers.mjs';

const id = readLocal('manual-final-state.json').accounts.company.companyId;
assert.ok(Number.isSafeInteger(id) && id > 0);
const query = `BEGIN READ ONLY;
select json_build_object(
  'databaseZone',current_setting('TimeZone'),
  'utcToday',(now() at time zone 'UTC')::date,
  'columnType',(select data_type from information_schema.columns where table_name='applications' and column_name='applied_at'),
  'allTime',(select count(*) from applications a join jobs j on j.id=a.job_id where j.company_id=${id}),
  'last30UtcCalendarDays',(select count(*) from applications a join jobs j on j.id=a.job_id where j.company_id=${id} and a.applied_at>=((now() at time zone 'UTC')::date-29) and a.applied_at<((now() at time zone 'UTC')::date+1)),
  'storedDateCounts',(select json_agg(r) from (select a.applied_at::date as day,count(*) as count from applications a join jobs j on j.id=a.job_id where j.company_id=${id} group by a.applied_at::date order by day)r),
  'ownedJobs',(select count(*) from jobs where company_id=${id}),
  'distinctApplicants',(select count(distinct a.student_id) from applications a join jobs j on j.id=a.job_id where j.company_id=${id})
);
COMMIT;`;
const data = JSON.parse(execFileSync('docker', ['exec', '-i', 'student-job-recommendation-system-postgres-1', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -v ON_ERROR_STOP=1'], { input: query, encoding: 'utf8' }).trim());
const backendCalendar = execFileSync('docker', ['exec', 'student-job-recommendation-system-backend-1', 'date', '+%Y-%m-%dT%H:%M:%S%z %Z'], { encoding: 'utf8' }).trim();
writeLocal('neo-aurora-date-audit.json', { measuredAt: new Date().toISOString(), ...data, backendCalendar });
console.log(JSON.stringify({ ...data, backendCalendar }));
