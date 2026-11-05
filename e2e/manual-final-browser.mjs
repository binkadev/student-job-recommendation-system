import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { local, readLocal, writeLocal, ok } from './helpers.mjs';
import { parseCsv } from './analytics-csv.mjs';

// No routes, HTTP interception, storage-injected login or fixture cleanup.
const credentials=readLocal('manual-final-credentials.json'), state=readLocal('manual-final-state.json');
const readOnly=process.argv.includes('--read-only');
const evidenceName=readOnly?'manual-final-handoff-browser-evidence.json':'manual-final-browser-evidence.json';
const screenshotDirectory=readOnly?'manual-final-handoff-browser':'manual-final-browser';
const evidence={startedAt:new Date().toISOString(),readOnlyBusinessData:readOnly,screens:[],http:[],pageErrors:[],consoleErrors:[],actions:{}};
const journal=fs.existsSync(`${local}/manual-final-browser-actions.json`)?readLocal('manual-final-browser-actions.json'):{};
const once=async(key,action)=>{if(readOnly){evidence.actions[key]={executed:false,previousEvidence:journal[key]??null};return;}if(!journal[key]){journal[key]=await action();writeLocal('manual-final-browser-actions.json',journal);} evidence.actions[key]=journal[key];};
const browser=await chromium.launch({headless:true});
fs.mkdirSync(`${local}/${screenshotDirectory}`,{recursive:true});
const contexts=[];
const received=(page,path,method)=>page.waitForResponse(r=>new URL(r.url()).pathname===`/api${path}` && r.request().method()===method,{timeout:90000});
async function signIn(alias) {
  const context=await browser.newContext({baseURL:'http://localhost:5173',viewport:{width:1440,height:1000},acceptDownloads:true});contexts.push(context);
  const page=await context.newPage();
  page.on('pageerror',e=>evidence.pageErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error') evidence.consoleErrors.push(m.text());});
  page.on('response',r=>{const url=new URL(r.url());if(url.pathname.startsWith('/api/'))evidence.http.push({alias,path:url.pathname,query:url.search,method:r.request().method(),status:r.status()});});
  await page.goto('/login');
  await page.getByRole('textbox',{name:'Email',exact:true}).fill(credentials.accounts[alias].email);
  await page.locator('input[name="password"]').fill(credentials.accounts[alias].password);
  const login=received(page,'/auth/login','POST');
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click(); assert.equal((await login).status(),200);
  await expect(page).toHaveURL(`/${alias==='student'?'candidate':'recruiter'}/dashboard`);
  return page;
}
async function screen(page,alias,path,requiredApi=true) {
  const start=evidence.http.length;
  await page.goto(path); await page.waitForLoadState('networkidle');
  await expect(page.locator('#main-content')).toBeVisible();
  assert.equal(new URL(page.url()).pathname,path); assert.ok((await page.locator('#main-content').innerText()).length>30);
  await page.reload(); await page.waitForLoadState('networkidle');
  const http=evidence.http.slice(start); assert.ok(http.every(r=>r.status<400),`HTTP failure on ${path}`);
  if(requiredApi) assert.ok(http.some(r=>r.method==='GET' && r.status===200),`No real GET on ${path}`);
  await page.screenshot({path:`${local}/${screenshotDirectory}/${alias}-${evidence.screens.length+1}.png`,fullPage:true});
  evidence.screens.push({alias,path,reload:true,apiResponses:http.length,passed:true});writeLocal(evidenceName,evidence);
}
try {
  let student=await signIn('student'), screenIndex=0;
  for(const path of ['/candidate/dashboard','/candidate/profile','/candidate/profile/edit','/candidate/profile/preferences','/candidate/cvs',...state.cvs.student.flatMap(cv=>[`/candidate/cvs/${cv.id}`,`/candidate/cvs/${cv.id}/analysis`]),'/candidate/jobs/recommended','/candidate/jobs/saved','/candidate/applications','/candidate/notifications','/candidate/settings/account','/candidate/settings/security','/candidate/settings/privacy','/candidate/settings/notifications']) {
    if(screenIndex++ && screenIndex%4===0){await student.context().close();student=await signIn('student');}
    await screen(student,'student',path,!/security|privacy/.test(path));
  }
  await once('student-profile-save',async()=>{
    await student.goto('/candidate/profile/edit'); await student.getByRole('button',{name:'Giới thiệu',exact:true}).click();
    const summary=student.getByLabel('Giới thiệu bản thân',{exact:true}); await expect(summary).not.toHaveValue('');
    const old=await summary.inputValue(); await summary.fill(`${old}\nHồ sơ tổng hợp dành cho manual final demo.`);
    const response=received(student,'/students/me/profile-aggregate','PUT'); await student.getByRole('button',{name:'Lưu hồ sơ',exact:true}).click();
    assert.equal((await response).status(),200); await student.reload(); await expect(summary).toHaveValue(`${old}\nHồ sơ tổng hợp dành cho manual final demo.`);return {http:200,reload:true};
  });
  await once('student-career-save',async()=>{
    await student.goto('/candidate/profile/preferences'); await expect(student.getByLabel('Vị trí mong muốn',{exact:true})).toHaveValue('Backend Java Intern / Fresher');
    const response=received(student,'/students/me/profile','PUT'); await student.getByRole('button',{name:'Lưu thiết lập',exact:true}).click();assert.equal((await response).status(),200);
    await student.reload(); await expect(student.getByLabel('Vị trí mong muốn',{exact:true})).toHaveValue('Backend Java Intern / Fresher');return {http:200,reload:true};
  });
  await once('student-generate',async()=>{
    await student.goto('/candidate/jobs/recommended'); await student.getByLabel('CV dùng để gợi ý',{exact:true}).selectOption(String(state.cvs.student[0].id));
    await student.getByLabel('Ngưỡng xếp hạng',{exact:true}).fill('0'); await student.getByLabel('Số kết quả tối đa',{exact:true}).fill('100');
    const response=received(student,'/students/me/recommendations/generate','POST'); await student.getByRole('button',{name:'Cập nhật gợi ý',exact:true}).click();
    const r=await response; assert.equal(r.status(),200); const run=(await r.json()).data;assert.equal(run.status,'SUCCESS');
    await student.getByRole('button',{name:'Xem phân tích',exact:true}).first().click();await expect(student.getByRole('dialog')).toBeVisible();await student.keyboard.press('Escape');
    await student.reload();await expect(student.getByText(`#${run.id}`,{exact:true}).first()).toBeVisible();return {http:200,runId:run.id,reload:true};
  });
  await student.goto('/recruiter/company'); await expect(student).toHaveURL('/403'); evidence.actions.studentRoleGuard=403;
  await student.context().close();
  let company=await signIn('company'); screenIndex=0;
  const token=(await ok('POST','/auth/login',null,credentials.accounts.company)).token;
  const apps=(await ok('GET','/companies/me/applications?size=100',token)).items;
  const mainApp=apps.find(a=>a.studentId===state.accounts.student.studentId && a.jobId===state.jobs['job-1'].id);
  for(const path of ['/recruiter/dashboard','/recruiter/company','/recruiter/company/edit','/recruiter/jobs',`/recruiter/jobs/${state.jobs['job-1'].id}`,'/recruiter/candidates',`/recruiter/candidates/${mainApp.id}`,'/recruiter/saved-candidates',`/recruiter/jobs/${state.jobs['job-2'].id}/candidate-ranking`,'/recruiter/reports','/recruiter/notifications','/recruiter/settings/account','/recruiter/settings/notifications','/recruiter/settings/security']) {
    if(screenIndex++ && screenIndex%4===0){await company.context().close();company=await signIn('company');}
    await screen(company,'company',path,!path.endsWith('/security'));
  }
  await once('company-note',async()=>{
    await company.goto('/recruiter/saved-candidates');await company.getByRole('button',{name:'Sửa ghi chú',exact:true}).first().click();
    const text='datn-manual-final-v1: Đã xác minh CV bằng browser; ưu tiên trao đổi dự án, API và SQL với mentor.';
    await company.getByLabel('Ghi chú đánh giá',{exact:true}).fill(text);
    const response=company.waitForResponse(r=>/\/saved-candidates\/\d+\/note$/.test(new URL(r.url()).pathname) && r.request().method()==='PATCH');
    await company.getByRole('button',{name:'Lưu ghi chú',exact:true}).click();assert.equal((await response).status(),200);await company.reload();await expect(company.getByText(text,{exact:true})).toBeVisible();return {http:200,reload:true};
  });
  await once('company-application-review',async()=>{
    const app=apps.find(a=>a.studentId===state.accounts.frontend.studentId && a.jobId===state.jobs['job-3'].id);assert.equal(app.status,'PENDING');
    await company.goto(`/recruiter/candidates/${app.id}`);await company.getByLabel('Chuyển trạng thái',{exact:true}).selectOption('REVIEWED');
    const response=received(company,`/applications/${app.id}/status`,'PATCH');await company.getByRole('button',{name:'Cập nhật trạng thái',exact:true}).click();assert.equal((await response).status(),200);
    await company.reload();await expect(company.getByText('Đã xem',{exact:true}).first()).toBeVisible();return {http:200,applicationId:app.id,reload:true};
  });
  await company.goto(`/recruiter/candidates/${mainApp.id}`);const cvResponse=received(company,`/companies/me/applications/${mainApp.id}/cv/file`,'GET');await company.getByRole('button',{name:'Xem CV',exact:true}).click();assert.equal((await cvResponse).status(),200);evidence.actions.companyCv=200;
  await once('company-ranking',async()=>{
    const jobId=state.jobs['job-2'].id;await company.goto(`/recruiter/jobs/${jobId}/candidate-ranking`);
    await company.getByLabel('Ngưỡng điểm',{exact:true}).fill('0');await company.getByLabel('Top phù hợp tổng thể',{exact:true}).fill('20');await company.getByLabel('Top đối sánh kỹ năng',{exact:true}).fill('20');
    const response=received(company,`/companies/me/jobs/${jobId}/candidate-ranking-runs`,'POST');await company.getByRole('button',{name:/^(Chạy lại|Chạy xếp hạng)$/}).click();
    const r=await response;assert.equal(r.status(),200);const run=(await r.json()).data;assert.equal(run.status,'SUCCESS');
    await company.getByRole('button',{name:'Xem lịch sử',exact:true}).click();await expect(company.locator('#ranking-run-history')).toBeVisible();await company.reload();await expect(company.getByRole('heading',{name:'Phù hợp tổng thể · 1',exact:true})).toBeVisible();return {http:200,runId:run.id,reload:true};
  });
  for(const days of [7,30,90]) {
    await company.goto('/recruiter/dashboard');await company.getByLabel('Khoảng thời gian',{exact:true}).selectOption(String(days));
    await expect(company.getByRole('table',{name:'Số đơn từng kỳ UTC',exact:true}).locator('tbody tr')).toHaveCount(days);
  }
  await company.goto('/recruiter/reports');const report=await ok('GET','/companies/me/recruitment-report',token);
  await expect(company.getByText('Đơn trong phạm vi lọc',{exact:true}).locator('..')).toContainText(String(report.summary.totalApplications));
  const downloaded=company.waitForEvent('download');await company.getByRole('button',{name:'Xuất toàn bộ CSV theo bộ lọc',exact:true}).click();
  const download=await downloaded;const rows=parseCsv(fs.readFileSync(await download.path(),'utf8'));assert.equal(rows.length-1,report.summary.totalApplications);assert.equal(rows.length-1,13);
  evidence.actions.csv={rows:rows.length-1,backendTotal:report.summary.totalApplications};
  await company.goto('/candidate/profile');await expect(company).toHaveURL('/403');evidence.actions.companyRoleGuard=403;
  assert.deepEqual(evidence.pageErrors,[]);assert.deepEqual(evidence.consoleErrors,[]);assert.ok(evidence.http.every(r=>r.status<400));
  if(readOnly) assert.ok(evidence.http.every(r=>r.method==='GET'||(r.method==='POST'&&r.path==='/api/auth/login')),'Read-only handoff must not mutate business data');
  evidence.passed=true;
} catch(error) {evidence.passed=false;evidence.failure={name:error.name,message:error.message};throw error;}
finally {evidence.finishedAt=new Date().toISOString();writeLocal(evidenceName,evidence);for(const context of contexts)await context.close();await browser.close();console.log(JSON.stringify({passed:evidence.passed,readOnlyBusinessData:readOnly,screens:evidence.screens.length,pageErrors:evidence.pageErrors.length,consoleErrors:evidence.consoleErrors.length,actions:evidence.actions}));}
