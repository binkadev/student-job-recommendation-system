import { buildOptions, login, measuredGet, writeSummary } from './lib/common.js';

const ENDPOINT = 'jobs-list';
export const options = buildOptions(ENDPOINT);

export function setup() {
  return { token: login(__ENV.STUDENT_EMAIL || 'perf.student.0001@example.test') };
}

export default function (data) {
  measuredGet('/api/jobs?page=1&size=20', ENDPOINT, data.token);
}

export function handleSummary(data) {
  return writeSummary(data);
}

