import assert from 'node:assert/strict';
import { api, apiBase, ok, readLocal, writeLocal } from './helpers.mjs';
import { parseCsv } from './analytics-csv.mjs';

// Read-only with respect to all application data. POST /auth/login only issues JWTs.
const credentials = readLocal('manual-final-credentials.json');
const state = readLocal('manual-final-state.json');
const tokens = {};
const evidence = { measuredAt:new Date().toISOString(), accounts:{}, cvs:[], recommendations:[], rankings:[], reports:[], security:{} };
for(const [alias,account] of Object.entries(credentials.accounts)) {
  const session=await ok('POST','/auth/login',null,{email:account.email,password:account.password});
  tokens[alias]=session.token; assert.equal(session.user.id,state.accounts[alias].userId); assert.equal(session.user.role,account.role);
  evidence.accounts[alias]={email:account.email,role:account.role,userId:session.user.id};
}
const student=tokens.student, company=tokens.company;
const countBy=(rows,key)=>rows.reduce((counts,row)=>(counts[row[key]]=(counts[row[key]]||0)+1,counts),{});
const profile=await ok('GET','/students/me/profile-aggregate',student);
for(const field of ['summary','education','experience','projects','targetPosition']) assert.ok(profile.profile[field]);
assert.equal(profile.student.fullName,'Nguyễn Minh An');
const cvFiles=await ok('GET','/students/me/cv',student);
assert.equal(cvFiles.length,2); assert.equal(cvFiles.filter(c=>c.isActive).length,1);
for(const cv of cvFiles) {
  const analysis=await ok('GET',`/students/me/cv/${cv.id}/analysis`,student);
  assert.equal(analysis.status,'READY'); assert.ok(analysis.processedText); assert.ok(analysis.skills.length);
  assert.equal(analysis.processingVersion,'bilingual-nlp-v2-skills-v1'); assert.ok(analysis.languageConfidence>=0.65);
  const file=await fetch(`${apiBase}/api/students/me/cv/${cv.id}/file`,{headers:{Authorization:`Bearer ${student}`}});
  assert.equal(file.status,200); assert.ok((await file.arrayBuffer()).byteLength>100);
  evidence.cvs.push({id:cv.id,active:cv.isActive,language:analysis.languageCode,confidence:analysis.languageConfidence,processingVersion:analysis.processingVersion,skillCount:analysis.skills.length,download:200});
}
assert.deepEqual(evidence.cvs.map(c=>c.language).sort(),['en','vi']);
const companyProfile=await ok('GET','/companies/me',company); assert.equal(companyProfile.status,'VERIFIED');
evidence.accounts.company.companyStatus=companyProfile.status;
const jobs=(await ok('GET','/companies/me/jobs?size=100',company)).items;
evidence.jobCounts=countBy(jobs,'status'); assert.equal(jobs.length,11);
const applications=(await ok('GET','/companies/me/applications?size=100',company)).items;
const studentApps=await ok('GET','/students/me/applications',student);
evidence.applications=countBy(applications,'status'); evidence.studentApplications=countBy(studentApps,'status');
for(const status of ['PENDING','REVIEWED','ACCEPTED','REJECTED','WITHDRAWN']) assert.ok(evidence.studentApplications[status]);
assert.ok(studentApps.some(a=>a.status==='REJECTED' && studentApps.some(b=>b.jobId===a.jobId && b.id>a.id && b.status==='PENDING')));
const saved=await ok('GET','/students/me/saved-jobs?size=100',student); assert.ok(saved.totalItems>=3); evidence.savedJobs=saved.totalItems;
const candidates=await ok('GET','/companies/me/saved-candidates?size=100',company);
evidence.savedCandidates=candidates.totalItems;
for(const candidate of candidates.items) {
  assert.ok(candidate.note); assert.ok(candidate.revision>=1);
  const cv=await fetch(`${apiBase}/api/companies/me/applications/${candidate.applicationId}/cv/file`,{headers:{Authorization:`Bearer ${company}`}});
  assert.equal(cv.status,200); await cv.arrayBuffer();
}
function validate(results,isCompany,skillsByJob,rankingJobId) {
  const ranks={PRIMARY:0,FALLBACK:0}, previous={}; let fallbackSeen=false;
  for(const [index,r] of results.entries()) {
    assert.ok(Number.isFinite(r.rankingScore) && r.rankingScore>=0 && r.rankingScore<=1);
    assert.equal(r.score,r.rankingScore); assert.equal(r.tierRankPosition,++ranks[r.rankingTier]);
    if(!isCompany) assert.equal(r.rankPosition,index+1);
    if(r.rankingTier==='PRIMARY') {
      if(!isCompany) assert.ok(!fallbackSeen);
      assert.equal(r.scoringStrategy,'SAME_LANGUAGE_HYBRID'); assert.notEqual(r.textScore,null);
      assert.equal(r.overallScore,r.rankingScore);
      const skillCount=skillsByJob.get(isCompany ? rankingJobId : r.jobId); assert.notEqual(skillCount,undefined);
      assert.ok(Math.abs(r.rankingScore-(skillCount?0.65*r.textScore+0.35*r.skillScore:r.textScore))<0.0001);
    } else {
      assert.equal(r.rankingTier,'FALLBACK'); fallbackSeen=true;
      assert.equal(r.scoringStrategy,'CROSS_LANGUAGE_SKILL_BASED'); assert.equal(r.textScore,null); assert.equal(r.overallScore,null); assert.equal(r.rankingScore,r.skillScore);
    }
    assert.ok(r.explanation || r.reason, 'Persisted explanation required');
    const prev=previous[r.rankingTier], id=isCompany?'applicationId':'jobId';
    if(prev) { assert.ok(r.rankingScore<=prev.rankingScore); if(r.rankingScore===prev.rankingScore) assert.ok(r[id]>prev[id]); }
    previous[r.rankingTier]=r;
  }
  return ranks;
}
for(const run of await ok('GET','/students/me/recommendation-runs',student)) {
  assert.equal(run.status,'SUCCESS'); assert.equal(run.algorithmVersion,'bilingual-recommendation-v3');
  const detail=await ok('GET',`/students/me/recommendation-runs/${run.id}`,student);
  const skillCounts=new Map(); for(const r of detail.results) { const j=await ok('GET',`/jobs/${r.jobId}`,student); skillCounts.set(j.id,j.skills.length); }
  const tiers=validate(detail.results,false,skillCounts); assert.ok(tiers.PRIMARY && tiers.FALLBACK);
  evidence.recommendations.push({id:run.id,cvId:run.cvId,count:detail.results.length,tiers});
}
for(const key of ['job-1','job-2']) {
  const job=jobs.find(j=>j.id===state.jobs[key].id), route=`/companies/me/jobs/${job.id}/candidate-ranking-runs`;
  const runs=await ok('GET',route,company);
  for(const run of runs.items) {
    const detail=await ok('GET',`${route}/${run.id}`,company);
    assert.equal(run.status,'SUCCESS'); assert.equal(run.algorithmVersion,'bilingual-candidate-ranking-v3');
    const results=detail.results || [...(detail.primaryResults||[]),...(detail.fallbackResults||[])];
    assert.ok(results.length); const tiers=validate(results,true,new Map([[job.id,job.skills.length]]),job.id);
    evidence.rankings.push({jobId:job.id,id:run.id,count:results.length,tiers});
  }
}
for(const alias of ['student','company']) {
  const inbox=await ok('GET','/notifications?size=100',tokens[alias]); evidence[`${alias}Notifications`]=inbox.totalItems;
  const prefs=await ok('GET','/users/me/notification-settings',tokens[alias]); assert.equal(prefs.applicationStatusEnabled,true);
}
assert.ok(evidence.studentNotifications>=4); assert.equal(evidence.companyNotifications,0);
for(const days of [7,30,90]) {
  const dashboard=await ok('GET',`/companies/me/dashboard-summary?days=${days}`,company);
  assert.equal(dashboard.totalJobs,jobs.length); assert.equal(dashboard.summary.totalApplications,applications.length); assert.equal(dashboard.summary.uniqueStudents,3);
  assert.equal(dashboard.trend.length,days);
  const expectedTrend=applications.filter(a=>a.appliedAt.slice(0,10)>=dashboard.trendFrom && a.appliedAt.slice(0,10)<=dashboard.trendTo).length;
  assert.equal(dashboard.trend.reduce((n,row)=>n+row.applications,0),expectedTrend);
  // Include the actual persisted civil date; do not backdate data for trends.
  const to=studentApps.map(a=>a.appliedAt.slice(0,10)).sort().at(-1);
  const start=new Date(`${to}T00:00:00Z`); start.setUTCDate(start.getUTCDate()-days+1); const from=start.toISOString().slice(0,10);
  const query=`from=${from}&to=${to}`;
  const report=await ok('GET',`/companies/me/recruitment-report?${query}&size=100`,company);
  const exported=await ok('GET',`/companies/me/recruitment-report/export?${query}`,company);
  assert.equal(report.summary.totalApplications,applications.length); assert.equal(exported.rowCount,applications.length);
  const rows=parseCsv(exported.csv); assert.equal(rows.length-1,applications.length);
  assert.deepEqual(rows.slice(1).map(r=>Number(r[0])).sort((a,b)=>a-b),applications.map(a=>a.id).sort((a,b)=>a-b));
  evidence.reports.push({days,from,to,applications:report.summary.totalApplications,csvRows:exported.rowCount,dashboardTrendFrom:dashboard.trendFrom,dashboardTrendTo:dashboard.trendTo,dashboardTrendApplications:expectedTrend});
}
for(const [name,route,token,expected] of [
  ['studentCompanyList','/companies/me/applications',student,403],
  ['companyStudentProfile','/students/me/profile-aggregate',company,403],
  ['auxiliaryForeignCv',`/students/me/cv/${cvFiles[0].id}`,tokens.frontend,404],
  ['anonymousApplications','/students/me/applications',null,401],
]) { const result=await api('GET',route,token); assert.equal(result.status,expected); evidence.security[name]=result.status; }
evidence.passed=true; writeLocal('manual-final-verification.json',evidence);
console.log(JSON.stringify(evidence));
