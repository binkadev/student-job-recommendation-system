import { buildOptions, measuredGet, resolveToken, writeSummary } from './lib/common.js';

const ENDPOINT = 'saved-jobs';
export const options = buildOptions(ENDPOINT);

export function setup() {
  return { token: resolveToken(__ENV.STUDENT_EMAIL || 'perf.student.0001@example.test') };
}

export default function (data) {
  measuredGet('/api/students/me/saved-jobs?page=1&size=20', ENDPOINT, data.token);
}

export function handleSummary(data) {
  return writeSummary(data);
}
