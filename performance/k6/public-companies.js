import { buildOptions, measuredGet, writeSummary } from './lib/common.js';

const ENDPOINT = 'public-companies';
export const options = buildOptions(ENDPOINT);

export default function () {
  measuredGet(
    '/api/public/companies?page=1&size=20&sort=createdAt%2Cdesc',
    ENDPOINT,
  );
}

export function handleSummary(data) {
  return writeSummary(data);
}
