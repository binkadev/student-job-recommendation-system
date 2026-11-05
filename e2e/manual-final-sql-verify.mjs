import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readLocal, writeLocal } from './helpers.mjs';
const state=readLocal('manual-final-state.json'), api=readLocal('manual-final-verification.json');
const companyId=state.accounts.company.companyId, studentId=state.accounts.student.studentId;
for(const id of [companyId,studentId]) assert.ok(Number.isSafeInteger(id) && id>0);
const query=`BEGIN READ ONLY;
select json_build_object(
 'jobs',(select json_object_agg(status,n) from (select status,count(*) n from jobs where company_id=${companyId} group by status)s),
 'applications',(select json_object_agg(status,n) from (select a.status,count(*) n from applications a join jobs j on j.id=a.job_id where j.company_id=${companyId} group by a.status)s),
 'uniqueStudents',(select count(distinct a.student_id) from applications a join jobs j on j.id=a.job_id where j.company_id=${companyId}),
 'cvs',(select json_agg(json_build_object('id',id,'status',analysis_status,'language',language_code,'processingVersion',processing_version,'skills',jsonb_array_length(extracted_skills),'processed',length(processed_text)>0)) from cv_files where student_id=${studentId}),
 'recommendationRuns',(select count(*) from recommendation_runs where student_id=${studentId} and status='SUCCESS'),
 'recommendationResults',(select count(*) from recommendation_results r join recommendation_runs u on u.id=r.run_id where u.student_id=${studentId}),
 'rankingRuns',(select count(*) from candidate_ranking_runs u join jobs j on j.id=u.job_id where j.company_id=${companyId} and u.status='SUCCESS'),
 'rankingResults',(select count(*) from candidate_ranking_results r join candidate_ranking_runs u on u.id=r.run_id join jobs j on j.id=u.job_id where j.company_id=${companyId}),
 'savedJobs',(select count(*) from saved_jobs where student_id=${studentId}),
 'savedCandidates',(select count(*) from saved_candidates where company_id=${companyId}),
 'notes',(select json_agg(json_build_object('id',id,'revision',revision,'hasNote',length(note)>0)) from saved_candidates where company_id=${companyId}),
 'applicationDates',(select json_agg(d) from (select a.applied_at::date as applied_date,count(*) applications from applications a join jobs j on j.id=a.job_id where j.company_id=${companyId} group by a.applied_at::date)d),
 'flyway',(select max(version::int) from flyway_schema_history where success)
);
COMMIT;`;
const raw=execFileSync('docker',['exec','-i','student-job-recommendation-system-postgres-1','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atq -v ON_ERROR_STOP=1'],{input:query,encoding:'utf8'});
const data=JSON.parse(raw.trim());
assert.deepEqual(data.jobs,api.jobCounts);assert.deepEqual(data.applications,api.applications);assert.equal(data.uniqueStudents,3);
assert.equal(data.savedJobs,api.savedJobs);assert.equal(data.savedCandidates,api.savedCandidates);
assert.equal(data.recommendationRuns,api.recommendations.length);assert.equal(data.recommendationResults,api.recommendations.reduce((n,r)=>n+r.count,0));
assert.equal(data.rankingRuns,api.rankings.length);assert.equal(data.rankingResults,api.rankings.reduce((n,r)=>n+r.count,0));
assert.ok(data.cvs.every(c=>c.status==='READY' && c.processed && c.skills>0));assert.ok(data.notes.every(n=>n.hasNote && n.revision>=1));assert.equal(data.flyway,21);
writeLocal('manual-final-sql-verification.json',{...data,passed:true,measuredAt:new Date().toISOString()});console.log(JSON.stringify(data));
