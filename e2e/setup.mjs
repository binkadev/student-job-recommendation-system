import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { accounts, jobs, studentProfile, companyProfile, namespace } from './dataset.mjs';
import { api, ok, login, devAdmin, credentials, root, local, upload, writeLocal } from './helpers.mjs';

execFileSync(process.env.E2E_PYTHON || 'python', [`${root}/generate-cvs.py`], { stdio: 'inherit' });
const creds = credentials();
const admin = await devAdmin();
const manifest = { namespace, generatedAt: new Date().toISOString(), accounts: {}, jobs: [], cvs: {}, baseline: await ok('GET', '/public/statistics'), adminAvailable: !!admin };
const tokens = {};
for (const [alias, account] of Object.entries(accounts)) {
  const trial = await api('POST', '/auth/login', null, { email: creds[alias].email, password: creds[alias].password });
  if (!trial.success) {
    // Registration collision is an error; never overwrite an existing account's password.
    await ok('POST', '/auth/register', null, creds[alias]);
  }
  tokens[alias] = await login(alias);
  const me = await ok('GET', '/auth/me', tokens[alias]);
  if (me.role !== account.role) throw new Error(`Role mismatch for ${alias}`);
  manifest.accounts[alias] = { userId: me.id, role: me.role };
  console.log(`Authenticated ${alias} (${account.role})`);
}
const catalog = (await ok('GET', '/skills?size=100', tokens.student)).items;
// Canonical technologies absent from the small dev catalog are created through
// the existing Admin catalog API, never inserted into DB or invented by AI.
if (admin) {
  for (const name of ['Python', 'SQL']) {
    if (!catalog.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      catalog.push(await ok('POST', '/skills', admin, { name, category: name === 'SQL' ? 'Database' : 'Programming Language', description: 'Canonical technology used by the synthetic E2E dataset.' }));
    }
  }
}
const findSkill = (name) => catalog.find((s) => s.name.toLowerCase() === name.toLowerCase());
manifest.catalogMissing = [...new Set(jobs.flatMap(j => j.skillNames))].filter(name => !findSkill(name));
for (const alias of ['student', 'frontend', 'data']) {
  const me = await ok('GET', '/students/me', tokens[alias]);
  manifest.accounts[alias].studentId = me.id;
  // Only populate profiles the first time. Re-running preserves manual demo edits.
  const profile = await ok('GET', '/students/me/profile', tokens[alias]);
  if (!profile.summary) {
    await ok('PUT', '/students/me', tokens[alias], { fullName: accounts[alias].fullName, major: 'Công nghệ phần mềm', university: 'Chương trình đại học giả định E2E', graduationYear: 2026, location: 'Thành phố Hồ Chí Minh', headline: alias === 'student' ? 'Backend Developer Intern / Fresher' : alias === 'frontend' ? 'Frontend React Intern' : 'Data Analyst Intern' });
    await ok('PUT', '/students/me/profile', tokens[alias], alias === 'student' ? studentProfile : { ...studentProfile, targetPosition: alias === 'frontend' ? 'Frontend React Intern' : 'Data Analyst Intern' });
  }
  if (!(await ok('GET', '/students/me/skills', tokens[alias])).length) {
    const names = alias === 'student' ? ['Java', 'Spring Boot', 'PostgreSQL', 'Git', 'Docker'] : alias === 'frontend' ? ['React', 'TypeScript', 'JavaScript', 'Git'] : ['Python', 'SQL', 'PostgreSQL'];
    await ok('PUT', '/students/me/skills', tokens[alias], { skills: names.filter(findSkill).map(name => ({ skillId: findSkill(name).id, proficiencyLevel: 'INTERMEDIATE', source: 'MANUAL', yearsOfExperience: 0 })) });
  }
}
for (const alias of ['company', 'companyB', 'companyC']) {
  let company = await ok('GET', '/companies/me', tokens[alias]);
  manifest.accounts[alias].companyId = company.id;
  manifest.accounts[alias].registrationStatus = company.status;
  if (!company.description) company = await ok('PUT', '/companies/me', tokens[alias], { ...companyProfile, companyName: accounts[alias].companyName });
  if (alias === 'companyC' && admin && company.status !== 'PENDING') {
    await ok('PATCH', `/admin/companies/${company.id}/status`, admin, { status: 'PENDING' });
  }
}
// Query all pages: /jobs intentionally includes other companies' active jobs.
const allJobs = [];
for (let page = 1; ; page++) {
  const data = await ok('GET', `/jobs?size=100&page=${page}`, tokens.company);
  allJobs.push(...data.items);
  if (page >= data.totalPages) break;
}
for (const fixture of jobs) {
  let job = allJobs.find(j => j.companyId === manifest.accounts.company.companyId && j.title === fixture.payload.title);
  if (!job) {
    job = await ok('POST', '/jobs', tokens.company, { ...fixture.payload, skills: fixture.skillNames.filter(findSkill).map(name => ({ skillId: findSkill(name).id, importance: 'REQUIRED', minLevel: 'BEGINNER' })) });
    if (fixture.targetStatus !== 'DRAFT') {
      job = await ok('PATCH', `/jobs/${job.id}/status`, tokens.company, { status: 'PENDING_APPROVAL' });
      if (fixture.targetStatus !== 'PENDING_APPROVAL' && admin) {
        job = await ok('PATCH', `/jobs/${job.id}/status`, admin, { status: 'ACTIVE' });
        if (['CLOSED', 'EXPIRED'].includes(fixture.targetStatus)) {
          job = await ok('PATCH', `/jobs/${job.id}/status`, fixture.targetStatus === 'CLOSED' ? tokens.company : admin, { status: fixture.targetStatus });
        }
      }
    }
  }
  const expectedSkills = fixture.skillNames.filter(findSkill).map(name => ({ skillId: findSkill(name).id, importance: 'REQUIRED', minLevel: 'BEGINNER' }));
  if (expectedSkills.some(s => !job.skills?.some(existing => existing.skillId === s.skillId))) {
    job = await ok('PUT', `/jobs/${job.id}`, tokens.company, { skills: expectedSkills });
  }
  manifest.jobs.push({ key: fixture.key, id: job.id, title: job.title, companyId: job.companyId, status: job.status, targetStatus: fixture.targetStatus, language: fixture.language, skillNames: fixture.skillNames.filter(findSkill) });
}
const cvFixtures = { student: ['datn-e2e-v1-khoa-vi.docx', 'datn-e2e-v1-khoa-en.pdf'], frontend: ['datn-e2e-v1-frontend-en.docx'], data: ['datn-e2e-v1-data-en.docx'] };
for (const [alias, files] of Object.entries(cvFixtures)) {
  const existing = await ok('GET', '/students/me/cv', tokens[alias]);
  manifest.cvs[alias] = [];
  for (const filename of files) {
    let cv = existing.find(c => c.originalFileName === filename);
    if (!cv) cv = await upload(tokens[alias], filename, !existing.length && manifest.cvs[alias].length === 0);
    let analysis = await ok('GET', `/students/me/cv/${cv.id}/analysis`, tokens[alias]);
    if (analysis.status !== 'READY') analysis = await ok('POST', `/students/me/cv/${cv.id}/reanalyze`, tokens[alias]);
    manifest.cvs[alias].push({ id: cv.id, filename, status: analysis.status, languageCode: analysis.languageCode, languageConfidence: analysis.languageConfidence, processingVersion: analysis.processingVersion, skills: analysis.skills });
  }
}
manifest.after = await ok('GET', '/public/statistics');
writeLocal('manifest.json', manifest);
console.log(`Setup complete: ${Object.keys(manifest.accounts).length} aliases, ${manifest.jobs.length} jobs, ${Object.values(manifest.cvs).flat().length} analyzed CVs; admin=${!!admin}.`);
console.log('Credentials and resource IDs saved under e2e/.local (gitignored). No cleanup performed.');
