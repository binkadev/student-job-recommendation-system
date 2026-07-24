import { buildOptions, login, measuredGet, writeSummary } from './lib/common.js';

const ENDPOINT = 'company-applications';
export const options = buildOptions(ENDPOINT);

export function setup() {
  return { token: login(__ENV.COMPANY_EMAIL || 'perf.company.001@example.test') };
}

export default function (data) {
  measuredGet(
    '/api/companies/me/applications?page=1&size=20&sort=appliedAt%2Cdesc',
    ENDPOINT,
    data.token,
  );
}

export function handleSummary(data) {
  return writeSummary(data);
}

