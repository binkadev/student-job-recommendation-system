import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { api, ok, devAdmin, upload, local, root, writeLocal, readLocal } from './helpers.mjs';
import { jobs as templates, studentProfile, companyProfile } from './dataset.mjs';

export const namespace = 'datn-manual-final-v1';
const exists = name => fs.existsSync(`${local}/${name}`);
assert.ok(exists('manual-final-baseline.json'), 'Capture manual-final-snapshot.mjs --baseline first');
// Do not authenticate Admin on completed reruns: login changes its metadata.
// Resolve existing authorized fixture only for a still-required Admin action.
let admin;
async function requireAdmin() {
  if(!admin) admin=await devAdmin();
  assert.ok(admin, 'Use E2E_USE_DEV_SEED_ADMIN=1; existing authorized Admin required');
  return admin;
}
const credentialsName = 'manual-final-credentials.json';
const definitions = {
  student: { email: 'manual.student@datn-e2e.invalid', fullName: 'Nguyễn Minh An', role: 'STUDENT' },
  company: { email: 'manual.company@datn-e2e.invalid', fullName: 'Minh Phát Demo Recruiter', companyName: 'Minh Phát Technology Demo', role: 'COMPANY' },
  frontend: { email: `${namespace}.frontend@datn-e2e.invalid`, fullName: 'Trần Anh Demo', role: 'STUDENT' },
  data: { email: `${namespace}.data@datn-e2e.invalid`, fullName: 'Lê Bình Demo', role: 'STUDENT' },
};
if (!exists(credentialsName)) writeLocal(credentialsName, { namespace, accounts: Object.fromEntries(Object.entries(definitions).map(([key, account]) => [key, { ...account, password: `Manual!${randomBytes(27).toString('base64url')}9a` }])) });
const credentials = readLocal(credentialsName);
assert.equal(credentials.namespace, namespace);
const state = exists('manual-final-state.json') ? readLocal('manual-final-state.json') : { namespace, accounts: {}, jobs: {}, cvs: {}, steps: {}, recommendationRuns: [], rankingRuns: [] };
assert.equal(state.namespace, namespace);
const save = () => writeLocal('manual-final-state.json', state);
const once = async (key, action) => { if (!state.steps[key]) { await action(); state.steps[key] = true; save(); } };
const tokens = {};
for (const [alias, definition] of Object.entries(definitions)) {
  const account = credentials.accounts[alias];
  assert.equal(account.email, definition.email); assert.equal(account.role, definition.role);
  const trial = await api('POST', '/auth/login', null, { email: account.email, password: account.password });
  if (!trial.success) {
    assert.ok(!state.accounts[alias], `Owned account ${alias} no longer authenticates; never reset its password`);
    await ok('POST', '/auth/register', null, account); // Collision fails; never reset an unknown existing email.
  }
  const logged = await ok('POST', '/auth/login', null, { email: account.email, password: account.password });
  assert.equal(logged.user.role, account.role); tokens[alias] = logged.token;
  if (state.accounts[alias]) assert.equal(logged.user.id, state.accounts[alias].userId);
  else { state.accounts[alias] = { userId: logged.user.id, role: account.role }; save(); }
}
let catalog = (await ok('GET', '/skills?size=100', tokens.student)).items;
const skills = ['Java','Spring Boot','PostgreSQL','SQL','Git','Docker','REST API'];
// Catalog creation is authorized through the existing Admin API, with no edits to old skills.
for (const name of skills) if (!catalog.some(s => s.name.toLowerCase() === name.toLowerCase())) catalog.push(await ok('POST', '/skills', await requireAdmin(), { name, category: 'Technology', description: 'Canonical technology for the synthetic manual demo.' }));
const find = name => catalog.find(s => s.name.toLowerCase() === name.toLowerCase());
for (const alias of ['student','frontend','data']) {
  const student = await ok('GET','/students/me',tokens[alias]); state.accounts[alias].studentId = student.id; save();
  await once(`profile-${alias}`, async () => {
    const snapshot = await ok('GET','/students/me/profile-aggregate',tokens[alias]);
    assert.ok(!snapshot.profile.summary, `Existing profile ${alias} requires review; do not overwrite edits`);
    const names = alias === 'student' ? skills : alias === 'frontend' ? ['React','TypeScript','Git'] : ['Python','SQL','PostgreSQL'];
    await ok('PUT','/students/me/profile-aggregate',tokens[alias], {
      revision: snapshot.revision,
      student: { fullName: definitions[alias].fullName, major: 'Công nghệ phần mềm', university: 'Đại học Công nghệ Minh An (giả định)', graduationYear: 2027, location: 'Thành phố Hồ Chí Minh', headline: 'Backend Java Intern / Fresher' },
      profile: { ...studentProfile, summary: studentProfile.summary.replace('E2E','manual demo'), targetPosition: alias === 'student' ? 'Backend Java Intern / Fresher' : alias === 'frontend' ? 'React Intern' : 'Data Analyst Intern' },
      manualSkills: names.filter(find).map(name => ({ skillId: find(name).id, proficiencyLevel: 'INTERMEDIATE', source: 'MANUAL', yearsOfExperience: 1 })),
    });
  });
}
let company = await ok('GET','/companies/me',tokens.company);
state.accounts.company.companyId = company.id; save();
await once('company-profile', async () => {
  assert.ok(!company.description, 'Existing Company profile requires review');
  company = await ok('PUT','/companies/me',tokens.company,{ ...companyProfile, companyName: definitions.company.companyName, address: 'Thành phố Hồ Chí Minh — văn phòng giả định manual demo', website: 'https://example.invalid', description: companyProfile.description.replaceAll('E2E','manual demo') },{ 'If-Match': `"${company.revision}"` });
});
await once('company-verify', async () => {
  assert.equal(company.status,'PENDING','Only newly registered pending Company can be initialized');
  await ok('PATCH',`/admin/companies/${company.id}/status`,await requireAdmin(),{ status:'VERIFIED' });
});
for (const alias of ['student','company']) await once(`notifications-${alias}`, async () => {
  const current = await api('GET','/users/me/notification-settings',tokens[alias]);
  await ok('PUT','/users/me/notification-settings',tokens[alias],{ applicationStatusEnabled:true, jobStatusEnabled:true, recommendationEnabled:true, systemEnabled:true },{ 'If-Match':current.etag });
});
// Eight meaningful active roles, one draft, one awaiting moderation, one closed.
const selected = [...templates.slice(0,8),templates[10],templates[11],templates[12]];
const owned = [];
for(let page=1;;page++) { const data = await ok('GET',`/companies/me/jobs?page=${page}&size=100`,tokens.company); owned.push(...data.items); if(page>=data.totalPages) break; }
for (const [index, template] of selected.entries()) {
  const key = `job-${index+1}`;
  if (state.steps[key]) continue; // Never restore statuses or overwrite content on rerun.
  const title = template.payload.title.replace('datn-e2e-v1',namespace);
  let job = owned.find(j=>j.title===title);
  if (!job) job = await ok('POST','/jobs',tokens.company,{ ...template.payload, title, deadline:'2027-12-31', description:template.payload.description.replaceAll('Sao Mai','Minh Phát').replaceAll('E2E','manual demo'), skills:template.skillNames.filter(find).map(name=>({skillId:find(name).id,importance:'REQUIRED',minLevel:'BEGINNER'})) });
  state.jobs[key] = {id:job.id,targetStatus:template.targetStatus}; save();
  if (template.targetStatus!=='DRAFT') {
    if(job.status==='DRAFT') job=await ok('PATCH',`/jobs/${job.id}/status`,tokens.company,{status:'PENDING_APPROVAL'});
    if(template.targetStatus!=='PENDING_APPROVAL' && job.status==='PENDING_APPROVAL') job=await ok('PATCH',`/jobs/${job.id}/status`,await requireAdmin(),{status:'ACTIVE'});
    if(template.targetStatus==='CLOSED' && job.status==='ACTIVE') job=await ok('PATCH',`/jobs/${job.id}/status`,tokens.company,{status:'CLOSED'});
  }
  assert.equal(job.status,template.targetStatus); state.steps[key]=true; save();
}
execFileSync(process.env.E2E_PYTHON || 'python',[`${root}/manual-final-cvs.py`],{stdio:'pipe'});
for(const [alias,files] of Object.entries({student:[`${namespace}-an-en.pdf`,`${namespace}-an-vi.docx`],frontend:[`${namespace}-frontend-en.docx`],data:[`${namespace}-data-en.docx`]})) {
  state.cvs[alias] ??= [];
  for(const filename of files) {
    if(state.cvs[alias].some(c=>c.filename===filename)) continue;
    const existing=await ok('GET','/students/me/cv',tokens[alias]);
    let cv=existing.find(c=>c.originalFileName===filename);
    if(!cv) cv=await upload(tokens[alias],filename,!existing.length);
    let analysis=await ok('GET',`/students/me/cv/${cv.id}/analysis`,tokens[alias]);
    if(analysis.status!=='READY') analysis=await ok('POST',`/students/me/cv/${cv.id}/reanalyze`,tokens[alias]);
    assert.equal(analysis.status,'READY'); assert.ok(analysis.skills.length); assert.equal(analysis.processingVersion,'bilingual-nlp-v2-skills-v1');
    state.cvs[alias].push({id:cv.id,filename,languageCode:analysis.languageCode}); save();
  }
}
for(const key of ['job-1','job-2','job-3']) await once(`saved-${key}`,async()=>{
  const saved=await ok('GET','/students/me/saved-jobs?size=100',tokens.student);
  if(!saved.items.some(j=>j.jobId===state.jobs[key].id)) await ok('POST',`/students/me/saved-jobs/${state.jobs[key].id}`,tokens.student);
});
const createApplication=async(alias,key,cvIndex=0)=>{
  const jobId=state.jobs[key].id;
  const apps=await ok('GET',`/students/me/applications?jobId=${jobId}`,tokens[alias]);
  if(apps.length) return apps.sort((a,b)=>b.id-a.id)[0];
  return ok('POST',`/jobs/${jobId}/apply`,tokens[alias],{cvFileId:state.cvs[alias][cvIndex].id,coverLetter:`${namespace}: Tôi mong muốn tham gia nhóm có người hướng dẫn, phát triển API và kiểm thử. Hồ sơ tổng hợp phục vụ trình diễn local.`});
};
for(const [index,status] of ['PENDING','REVIEWED','ACCEPTED','REJECTED','WITHDRAWN','REAPPLIED'].entries()) await once(`application-${index}`,async()=>{
  const key=`job-${index+1}`; let app=await createApplication('student',key,index%2);
  if(status==='REAPPLIED') {
    const history=await ok('GET',`/students/me/applications?jobId=${app.jobId}`,tokens.student);
    if(history.length===1) {
      if(app.status==='PENDING') app=await ok('PATCH',`/applications/${app.id}/status`,tokens.company,{status:'REJECTED'});
      assert.equal(app.status,'REJECTED');
      app=await ok('POST',`/jobs/${app.jobId}/apply`,tokens.student,{cvFileId:state.cvs.student[1].id,coverLetter:`${namespace}: Bổ sung hồ sơ và ứng tuyển lại sau phản hồi từ công ty.`});
    }
  } else if(status!=='PENDING' && app.status==='PENDING') app=await ok('PATCH',`/applications/${app.id}/status`,status==='WITHDRAWN'?tokens.student:tokens.company,{status});
});
for(const alias of ['frontend','data']) for(const key of ['job-1','job-2','job-3']) await once(`application-${alias}-${key}`,()=>createApplication(alias,key));
for(const alias of ['student','frontend','data']) await once(`candidate-${alias}`,async()=>{
  const apps=await ok('GET',`/students/me/applications?jobId=${state.jobs['job-1'].id}`,tokens[alias]);
  const app=apps[0]; const existing=await ok('GET',`/companies/me/saved-candidates?studentId=${app.studentId}`,tokens.company);
  if(!existing.items.length) {
    const saved=await ok('POST','/companies/me/saved-candidates',tokens.company,{applicationId:app.id,note:null});
    await ok('PATCH',`/companies/me/saved-candidates/${saved.id}/note`,tokens.company,{revision:saved.revision,note:`${namespace}: Đã xem dự án và CV. Trao đổi về thiết kế REST API, SQL và kế hoạch học tập với mentor.`});
  }
});
for(const cv of state.cvs.student) await once(`recommendation-${cv.id}`,async()=>{
  const previous=await ok('GET','/students/me/recommendation-runs',tokens.student);
  let run=previous.find(r=>r.cvId===cv.id && r.status==='SUCCESS');
  if(!run) run=await ok('POST','/students/me/recommendations/generate',tokens.student,{cvId:cv.id,threshold:0,limit:100});
  assert.equal(run.status,'SUCCESS'); state.recommendationRuns.push(run.id); save();
});
for(const key of ['job-1','job-2']) await once(`ranking-${key}`,async()=>{
  const route=`/companies/me/jobs/${state.jobs[key].id}/candidate-ranking-runs`;
  const previous=await ok('GET',route,tokens.company);
  let run=previous.items.find(r=>r.status==='SUCCESS');
  if(!run) run=await ok('POST',route,tokens.company,{threshold:0,primaryLimit:20,fallbackLimit:20});
  assert.equal(run.status,'SUCCESS'); state.rankingRuns.push({jobId:state.jobs[key].id,id:run.id}); save();
});
fs.writeFileSync(`${local}/manual-final-accounts.txt`,[
  'LOCAL MANUAL FINAL DEMO — http://localhost:5173',
  ...['student','company'].flatMap(alias=>[`${alias.toUpperCase()}: ${credentials.accounts[alias].email}`,`Password: ${credentials.accounts[alias].password}`]),
  'Login: mở /login, nhập email/password tương ứng. Đăng xuất trước khi đổi vai trò.',
  'Student: Dashboard, Hồ sơ, CV, Gợi ý việc làm, Việc đã lưu, Đơn ứng tuyển, Thông báo, Cài đặt.',
  'Company: Dashboard, Hồ sơ công ty, Tin tuyển dụng, Ứng viên, Hồ sơ đã lưu, Xếp hạng (chọn Job), Báo cáo, CSV, Cài đặt.',
  'Mong muốn nghề nghiệp lưu tại Student profile API. Không cung cấp tài khoản phụ như tài khoản chính.',
].join('\n'),{mode:0o600});
console.log(JSON.stringify({namespace,accounts:2,auxiliaryApplicants:2,jobs:Object.keys(state.jobs).length,cvs:Object.values(state.cvs).flat().length,recommendationRuns:state.recommendationRuns,rankingRuns:state.rankingRuns}));
