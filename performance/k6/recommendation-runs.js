import {
  buildOptions,
  measuredListGet,
  resolveToken,
  writeSummary,
} from './lib/common.js';

const ENDPOINT = 'recommendation-runs';
export const options = buildOptions(ENDPOINT);

export function setup() {
  return { token: resolveToken(__ENV.STUDENT_EMAIL || 'perf.student.0001@example.test') };
}

export default function (data) {
  measuredListGet('/api/students/me/recommendation-runs', ENDPOINT, data.token);
}

export function handleSummary(data) {
  return writeSummary(data);
}
