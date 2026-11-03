import { credentials, ok, login, writeLocal } from './helpers.mjs';
const state = { measuredAt: new Date().toISOString(), accounts: {}, statistics: await ok('GET', '/public/statistics') };
for (const [alias, account] of Object.entries(credentials())) {
  const token = await login(alias);
  const user = await ok('GET', '/auth/me', token);
  const resource = await ok('GET', user.role === 'STUDENT' ? '/students/me' : '/companies/me', token);
  state.accounts[alias] = { userId: user.id, role: user.role, resourceId: resource.id, status: resource.status ?? user.status };
  if (user.role === 'STUDENT') {
    const cvs = await ok('GET', '/students/me/cv', token);
    state.accounts[alias].cvs = await Promise.all(cvs.map(async cv => {
      const a = await ok('GET', `/students/me/cv/${cv.id}/analysis`, token);
      return { id: cv.id, filename: cv.originalFileName, active: cv.isActive, analysisStatus: a.status, language: a.languageCode, processingVersion: a.processingVersion };
    }));
    state.accounts[alias].applications = (await ok('GET', '/students/me/applications', token)).map(a => ({ id: a.id, jobId: a.jobId, status: a.status, cvId: a.cvFileId }));
  }
  if (alias === 'company') {
    const jobs = [];
    for (let page = 1; ; page++) {
      const data = await ok('GET', `/jobs?size=100&page=${page}`, token);
      jobs.push(...data.items.filter(j => j.companyId === resource.id));
      if (page >= data.totalPages) break;
    }
    state.jobs = jobs.map(j => ({ id: j.id, title: j.title, status: j.status, deadline: j.deadline, skills: j.skills.map(s => s.skillName) }));
  }
}
writeLocal('final-state.json', state);
console.log(JSON.stringify({ accounts: Object.keys(state.accounts).length, primaryCompanyJobs: state.jobs.length, primaryCvCount: state.accounts.student.cvs.length, primaryApplications: state.accounts.student.applications, statistics: state.statistics }));
