import { test, expect } from '@playwright/test';
import { api, ok, login, readLocal, writeLocal, upload, local, apiBase } from '../helpers.mjs';
import fs from 'node:fs';
import { jobs as fixtures } from '../dataset.mjs';

const m = readLocal('manifest.json');
const job = n => m.jobs.find(j => j.key === `job-${n}`);
const cv = alias => m.cvs[alias][0].id;
const evidence = {};
test.afterAll(() => writeLocal('api-evidence.json', evidence));

async function application(alias, jobId) {
  const token = await login(alias);
  const existing = await ok('GET', `/students/me/applications?jobId=${jobId}`, token);
  let latest = existing[0];
  if (!latest || latest.status === 'REJECTED') latest = await ok('POST', `/jobs/${jobId}/apply`, token, { cvFileId: cv(alias), coverLetter: 'Tôi muốn tham gia nhóm phát triển, có dự án học tập và mong nhận được phản hồi kỹ thuật. Nội dung tổng hợp E2E.' });
  return latest;
}

function validateScores(results, company = false, skillsByJob = new Map()) {
  const tierRanks = { PRIMARY: 0, FALLBACK: 0 };
  let fallbackSeen = false;
  let previous = {};
  results.forEach((r, i) => {
    expect(['PRIMARY', 'FALLBACK']).toContain(r.rankingTier);
    expect(r.rankingScore).toBeGreaterThanOrEqual(0);
    expect(r.rankingScore).toBeLessThanOrEqual(1);
    expect(r.score).toBe(r.rankingScore);
    expect(r.tierRankPosition).toBe(++tierRanks[r.rankingTier]);
    if (!company) expect(r.rankPosition).toBe(i + 1);
    if (r.rankingTier === 'PRIMARY') {
      if (!company) expect(fallbackSeen).toBe(false);
      expect(r.scoringStrategy).toBe('SAME_LANGUAGE_HYBRID');
      expect(r.textScore).not.toBeNull();
      expect(r.overallScore).toBe(r.rankingScore);
      const count = company ? job(2).skillNames.length : skillsByJob.get(r.jobId);
      expect(count).toBeDefined();
      const expected = count ? 0.65 * r.textScore + 0.35 * r.skillScore : r.textScore;
      expect(Math.abs(r.rankingScore - expected)).toBeLessThan(0.0001);
      if (!count) expect(r.skillScore).toBe(0);
    } else {
      fallbackSeen = true;
      expect(r.scoringStrategy).toBe('CROSS_LANGUAGE_SKILL_BASED');
      expect(r.textScore).toBeNull();
      expect(r.overallScore).toBeNull();
      expect(r.rankingScore).toBe(r.skillScore);
    }
    const prev = previous[r.rankingTier];
    if (prev) {
      expect(r.rankingScore).toBeLessThanOrEqual(prev.rankingScore);
      if (r.rankingScore === prev.rankingScore) expect(r[company ? 'applicationId' : 'jobId']).toBeGreaterThan(prev[company ? 'applicationId' : 'jobId']);
    }
    previous[r.rankingTier] = r;
  });
}

test('A01 durable identities, public search/detail and company profile persistence', async () => {
  for (const alias of ['student', 'company']) {
    const me = await ok('GET', '/auth/me', await login(alias));
    expect(me.id).toBe(m.accounts[alias].userId);
    expect(me.role).toBe(m.accounts[alias].role);
  }
  const found = await ok('GET', '/public/jobs?keyword=datn-e2e-v1&size=100');
  expect(found.page).toBe(1);
  expect(found.items.some(j => j.id === job(1).id)).toBe(true);
  for (const n of [11, 12, 13, 14, 15]) expect(found.items.some(j => j.id === job(n).id)).toBe(false);
  const details = await ok('GET', `/public/jobs/${job(1).id}`);
  expect(details.companyId).toBe(m.accounts.company.companyId);
  const company = await ok('GET', '/companies/me', await login('company'));
  expect(company.description).toContain('giả định');
  evidence.A01 = { userIds: [m.accounts.student.userId, m.accounts.company.userId], companyId: company.id, publicE2EJobs: found.totalItems, companyStatus: company.status };
});

test('A02 profile multiline edit, clear and read-back; invalid graduation rejected', async () => {
  const token = await login('student');
  const snapshot = await ok('GET', '/students/me/profile-aggregate', token);
  const before = snapshot.profile;
  let revision = snapshot.revision;
  await ok('PUT', '/students/me/profile', token, { ...before, summary: `${before.summary}\nKiểm chứng lưu hồ sơ E2E.` }, { 'If-Match': `"${revision++}"` });
  const updated = await ok('GET', '/students/me/profile', token);
  expect(updated.summary).toContain('\nKiểm chứng');
  expect(updated.projects).toBe(before.projects);
  await ok('PUT', '/students/me/profile', token, { experience: '' }, { 'If-Match': `"${revision++}"` });
  expect((await ok('GET', '/students/me/profile', token)).experience).toBeNull();
  await ok('PUT', '/students/me/profile', token, { summary: before.summary, experience: before.experience }, { 'If-Match': `"${revision++}"` });
  expect((await api('PUT', '/students/me', token, { graduationYear: 2200 })).status).toBe(400);
  evidence.A02 = { preservedProjects: true, clearPersisted: true, restored: true };
});

test('A03 real bilingual CV parsing, activation, raw download and protected deletion', async () => {
  const token = await login('student');
  const analyses = [];
  for (const file of m.cvs.student) {
    const analysis = await ok('GET', `/students/me/cv/${file.id}/analysis`, token);
    expect(analysis.status).toBe('READY');
    expect(analysis.processedText.length).toBeGreaterThan(30);
    expect(analysis.skills).toContain('java');
    expect(analysis.languageCode).toBe(file.filename.endsWith('.pdf') ? 'en' : 'vi');
    expect(analysis.processingVersion).toBe('bilingual-nlp-v2-skills-v1');
    await ok('PATCH', `/students/me/cv/${file.id}/active`, token);
    expect((await ok('GET', '/students/me/cv', token)).filter(c => c.isActive)).toHaveLength(1);
    const response = await fetch(`${apiBase}/api/students/me/cv/${file.id}/file`, { headers: { Authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(100);
    analyses.push({ id: file.id, status: analysis.status, language: analysis.languageCode, confidence: analysis.languageConfidence, skills: analysis.skills });
  }
  await ok('PATCH', `/students/me/cv/${cv('student')}/active`, token);
  expect((await api('PATCH', `/students/me/cv/${cv('student')}/extracted-data`, token, {})).status).toBe(501);
  const form = new FormData();
  form.append('file', new Blob(['invalid'], { type: 'text/plain' }), 'invalid.txt');
  expect((await api('POST', '/students/me/cv', token, form)).status).toBe(400);
  evidence.A03 = analyses;
});

test('A04 Student V3 two languages, official global/tier ranks and persisted snapshot', async () => {
  const token = await login('student');
  const runs = [];
  for (const file of m.cvs.student) {
    const snapshot = await ok('GET', `/students/me/cv/${file.id}/analysis`, token);
    const run = await ok('POST', '/students/me/recommendations/generate', token, { cvId: file.id, threshold: 0, limit: 100 });
    expect(run.status).toBe('SUCCESS');
    expect(run.algorithmVersion).toBe('bilingual-recommendation-v3');
    const detail = await ok('GET', `/students/me/recommendation-runs/${run.id}`, token);
    expect(detail.results.length).toBeGreaterThan(0);
    expect(detail.results.some(r => r.rankingTier === 'PRIMARY')).toBe(true);
    expect(detail.results.some(r => r.rankingTier === 'FALLBACK')).toBe(true);
    const jobsWithSkills = await Promise.all(detail.results.map(r => ok('GET', `/jobs/${r.jobId}`, token)));
    validateScores(detail.results, false, new Map(jobsWithSkills.map(j => [j.id, j.skills.length])));
    const after = await ok('GET', `/students/me/cv/${file.id}/analysis`, token);
    expect(after.processedText === snapshot.processedText && after.analyzedAt === snapshot.analyzedAt).toBe(true);
    expect((await ok('GET', '/students/me/recommendation-runs', token)).some(r => r.id === run.id)).toBe(true);
    runs.push({ id: run.id, cvId: file.id, results: detail.results.map(({ jobId, rankingTier, rankingScore, textScore, overallScore, skillScore, rankPosition, tierRankPosition }) => ({ jobId, rankingTier, rankingScore, textScore, overallScore, skillScore, rankPosition, tierRankPosition })) });
  }
  evidence.A04 = runs;
});

test('A05 save/unsave/re-save and three rounds of concurrent saves preserve uniqueness', async () => {
  const token = await login('student');
  const route = `/students/me/saved-jobs/${job(1).id}`;
  const initial = await ok('GET', '/students/me/saved-jobs?size=100', token);
  if (!initial.items.some(j => j.jobId === job(1).id)) await ok('POST', route, token);
  await ok('DELETE', route, token);
  const statuses = [];
  for (let round = 0; round < 3; round++) {
    const responses = await Promise.all([api('POST', route, token), api('POST', route, token)]);
    statuses.push(responses.map(r => r.status));
    expect(responses.every(r => [200, 400, 409].includes(r.status))).toBe(true);
    const saved = await ok('GET', '/students/me/saved-jobs?size=100', token);
    expect(saved.items.filter(j => j.jobId === job(1).id)).toHaveLength(1);
    if (round < 2) await ok('DELETE', route, token);
  }
  evidence.A05 = { jobId: job(1).id, rounds: statuses };
});

test('A06 cross-role application → reviewed → student status/notification; duplicate rejected', async () => {
  const app = await application('student', job(10).id);
  const company = await login('company');
  const student = await login('student');
  const detail = await ok('GET', `/companies/me/applications/${app.id}`, company);
  expect(detail.cvFileId).toBe(cv('student'));
  expect(detail.coverLetter.length).toBeGreaterThan(30);
  if (detail.status === 'PENDING') await ok('PATCH', `/applications/${app.id}/status`, company, { status: 'REVIEWED' });
  expect((await ok('GET', `/students/me/applications/${app.id}`, student)).status).toBe('REVIEWED');
  expect((await api('POST', `/jobs/${job(10).id}/apply`, student, { cvFileId: cv('student') })).status).toBe(409);
  const notifications = await ok('GET', '/notifications?size=100', student);
  expect(notifications.items.some(n => n.type === 'APPLICATION_STATUS_CHANGED')).toBe(true);
  expect((await api('PATCH', `/applications/${app.id}/status`, student, { status: 'ACCEPTED' })).status).toBe(403);
  expect((await api('DELETE', `/students/me/cv/${cv('student')}`, student)).status).toBe(409);
  evidence.A06 = { applicationId: app.id, jobId: app.jobId, status: 'REVIEWED', notification: true, usedCvDeleteBlocked: true };
});

test('A07 ownership denies company writes, student CV/run/application reads and forged CV', async () => {
  const companyB = await login('companyB');
  const otherStudent = await login('frontend');
  const app = await application('student', job(10).id);
  const checks = [
    await api('PUT', `/jobs/${job(1).id}`, companyB, { title: 'Forbidden E2E mutation' }),
    await api('PATCH', `/jobs/${job(1).id}/status`, companyB, { status: 'CLOSED' }),
    await api('GET', `/companies/me/applications/${app.id}`, companyB),
    await api('POST', `/companies/me/jobs/${job(1).id}/candidate-ranking-runs`, companyB, { threshold: 0, primaryLimit: 10, fallbackLimit: 10 }),
    await api('GET', `/students/me/cv/${cv('student')}`, otherStudent),
    await api('GET', `/students/me/cv/${cv('student')}/analysis`, otherStudent),
    await api('GET', `/students/me/applications/${app.id}`, otherStudent),
    await api('POST', '/students/me/recommendations/generate', otherStudent, { cvId: cv('student'), threshold: 0, limit: 10 }),
    await api('POST', `/jobs/${job(1).id}/apply`, otherStudent, { cvFileId: cv('student') }),
  ];
  checks.forEach(r => { expect([403, 404]).toContain(r.status); expect(r.success).toBe(false); expect(r.data).toBeNull(); });
  expect((await ok('GET', `/public/jobs/${job(1).id}`)).title).toBe(job(1).title);
  evidence.A07 = { statuses: checks.map(c => c.status) };
});

test('A08 ineligible jobs, role restrictions and invalid ranking limits', async () => {
  const student = await login('student');
  const checks = [];
  for (const number of [11, 12, 13, 14, 15]) {
    const r = await api('POST', `/jobs/${job(number).id}/apply`, student, { cvFileId: cv('student') });
    expect(r.status).toBe(400);
    checks.push({ jobId: job(number).id, status: job(number).status, http: r.status });
  }
  expect((await api('POST', '/jobs', student, fixtures[0].payload)).status).toBe(403);
  expect((await api('GET', '/students/me', await login('company'))).status).toBe(403);
  expect((await api('GET', '/students/me')).status).toBe(401);
  const invalid = await api('POST', `/companies/me/jobs/${job(1).id}/candidate-ranking-runs`, await login('company'), { threshold: 0, primaryLimit: 100, fallbackLimit: 1 });
  expect(invalid.status).toBe(400);
  evidence.A08 = checks;
});

test('A09 three concurrent apply rounds, reapply after REJECTED; WITHDRAWN blocks', async () => {
  const student = await login('data');
  const company = await login('company');
  const target = job(3).id;
  const rounds = [];
  for (let round = 0; round < 3; round++) {
    const current = (await ok('GET', `/students/me/applications?jobId=${target}`, student))[0];
    if (current && ['PENDING', 'REVIEWED'].includes(current.status)) await ok('PATCH', `/applications/${current.id}/status`, company, { status: 'REJECTED' });
    const responses = await Promise.all([api('POST', `/jobs/${target}/apply`, student, { cvFileId: cv('data') }), api('POST', `/jobs/${target}/apply`, student, { cvFileId: cv('data') })]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    const all = await ok('GET', `/students/me/applications?jobId=${target}`, student);
    expect(all.filter(a => ['PENDING', 'REVIEWED', 'ACCEPTED'].includes(a.status))).toHaveLength(1);
    rounds.push({ statuses: responses.map(r => r.status), applicationId: all[0].id });
  }
  const withdrawn = await application('frontend', job(5).id);
  const frontend = await login('frontend');
  if (withdrawn.status === 'PENDING') await ok('PATCH', `/applications/${withdrawn.id}/status`, frontend, { status: 'WITHDRAWN' });
  expect((await api('POST', `/jobs/${job(5).id}/apply`, frontend, { cvFileId: cv('frontend') })).status).toBe(400);
  evidence.A09 = { rounds, withdrawnId: withdrawn.id, withdrawnReapplyBlocked: true };
});

test('A10 Company V3 mixed corpus, independent limits/ranks, saved candidate uniqueness', async () => {
  for (const alias of ['student', 'frontend', 'data']) await application(alias, job(2).id);
  const company = await login('company');
  const route = `/companies/me/jobs/${job(2).id}/candidate-ranking-runs`;
  const run = await ok('POST', route, company, { threshold: 0, primaryLimit: 1, fallbackLimit: 2 });
  expect(run.status).toBe('SUCCESS');
  expect(run.algorithmVersion).toBe('bilingual-candidate-ranking-v3');
  const detail = await ok('GET', `${route}/${run.id}`, company);
  expect(detail.results.filter(r => r.rankingTier === 'PRIMARY')).toHaveLength(1);
  expect(detail.results.filter(r => r.rankingTier === 'FALLBACK')).toHaveLength(2);
  validateScores(detail.results, true);
  expect(detail.eligibleCandidates).toBe(3);
  const app = (await ok('GET', '/companies/me/applications?size=100', company)).items.find(a => a.studentId === m.accounts.student.studentId && a.jobId === job(2).id);
  const existing = (await ok('GET', '/companies/me/saved-candidates?size=100', company)).items.find(a => a.studentId === app.studentId);
  if (!existing) await ok('POST', '/companies/me/saved-candidates', company, { applicationId: app.id, note: 'Hồ sơ E2E phù hợp vị trí Java, cần trao đổi về dự án học tập.' });
  const duplicate = await api('POST', '/companies/me/saved-candidates', company, { applicationId: app.id });
  expect([200, 400, 409]).toContain(duplicate.status);
  expect((await ok('GET', '/companies/me/saved-candidates?size=100', company)).items.filter(a => a.studentId === app.studentId)).toHaveLength(1);
  expect((await api('GET', `${route}/${run.id}`, await login('companyB'))).status).toBe(404);
  evidence.A10 = { runId: run.id, eligible: detail.eligibleCandidates, results: detail.results.map(({ applicationId, rankingTier, rankingScore, tierRankPosition, textScore, overallScore }) => ({ applicationId, rankingTier, rankingScore, tierRankPosition, textScore, overallScore })) };
});

test('A11 secondary CV deletion, insufficient profile and notification settings persistence', async () => {
  const token = await login('incomplete');
  expect((await ok('GET', '/students/me/cv', token))).toHaveLength(0);
  const cvFile = await upload(token, 'datn-e2e-v1-low-skills.docx', false);
  await ok('DELETE', `/students/me/cv/${cvFile.id}`, token);
  expect((await api('GET', `/students/me/cv/${cvFile.id}`, token)).status).toBe(404);
  const settings = await ok('GET', '/users/me/notification-settings', token);
  const { updatedAt, ...values } = settings;
  await ok('PUT', '/users/me/notification-settings', token, { ...values, recommendationEnabled: !values.recommendationEnabled });
  expect((await ok('GET', '/users/me/notification-settings', token)).recommendationEnabled).toBe(!values.recommendationEnabled);
  await ok('PUT', '/users/me/notification-settings', token, values);
  evidence.A11 = { deletedTemporaryCv: cvFile.id, primaryCvsPreserved: true };
});

test('A12 NOT_READY/FAILED CV cannot score; real parser failure and oversized upload', async () => {
  const token = await login('incomplete');
  const pending = await upload(token, 'datn-e2e-v1-low-skills.docx', false);
  try {
    const generated = await api('POST', '/students/me/recommendations/generate', token, { cvId: pending.id, threshold: 0, limit: 10 });
    expect(generated.success).toBe(false);
    expect(generated.errorCode).toBe('CV_ANALYSIS_NOT_READY');
    const parsed = await ok('POST', `/students/me/cv/${pending.id}/reanalyze`, token);
    expect(parsed.status).toBe('READY');
    expect(parsed.skills.length).toBe(0);
  } finally { await ok('DELETE', `/students/me/cv/${pending.id}`, token); }
  const bad = new FormData();
  bad.append('file', new Blob(['%PDF-1.4\nmalformed E2E document'], { type: 'application/pdf' }), 'datn-e2e-v1-corrupt.pdf');
  const uploaded = await ok('POST', '/students/me/cv?active=false', token, bad);
  try {
    const parsed = await api('POST', `/students/me/cv/${uploaded.id}/reanalyze`, token);
    expect(parsed.success).toBe(false);
    expect((await ok('GET', `/students/me/cv/${uploaded.id}/analysis`, token)).status).toBe('FAILED');
    const generated = await api('POST', '/students/me/recommendations/generate', token, { cvId: uploaded.id, threshold: 0, limit: 10 });
    expect(generated.errorCode).toBe('CV_ANALYSIS_NOT_READY');
  } finally { await ok('DELETE', `/students/me/cv/${uploaded.id}`, token); }
  const large = new FormData();
  large.append('file', new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'application/pdf' }), 'datn-e2e-v1-large.pdf');
  const oversized = await api('POST', '/students/me/cv', token, large);
  expect(oversized.status).toBe(413);
  evidence.A12 = { notReadyBlocked: true, lowSkillReady: true, parserFailurePersisted: true, oversizedStatus: oversized.status };
});
