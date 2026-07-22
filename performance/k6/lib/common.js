import http from 'k6/http';
import { check, fail } from 'k6';
import { recordCheckResult, recordMeasuredResponse } from './metrics.js';

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

export function buildOptions(endpoint) {
  return {
    vus: positiveInteger(__ENV.VUS, 1, 'VUS'),
    iterations: positiveInteger(__ENV.ITERATIONS, 5, 'ITERATIONS'),
    summaryTrendStats: ['min', 'avg', 'med', 'p(50)', 'p(95)', 'p(99)', 'max'],
    systemTags: ['status', 'method', 'name', 'scenario'],
    tags: { phase: 'b1-tooling' },
    thresholds: {
      'checks{measured:true}': ['rate==1'],
      'http_req_failed{measured:true}': ['rate==0'],
      'correctness_error_rate{measured:true}': ['rate==0'],
      'dropped_iterations': ['count==0'],
      'http_req_duration{measured:true}': ['p(99)<30000'],
      'http_reqs{measured:true}': ['count>0'],
      [`measured_requests{endpoint:${endpoint}}`]: ['count>0'],
    },
  };
}

export function login(email) {
  const password = __ENV.PERFORMANCE_PASSWORD;
  if (!email || !password) {
    fail('The account email and PERFORMANCE_PASSWORD are required.');
  }

  const response = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'setup-login', measured: 'false' },
      responseCallback: http.expectedStatuses(200),
    },
  );

  let body;
  try {
    body = response.json();
  } catch (error) {
    fail(`Login did not return valid JSON (HTTP ${response.status}).`);
  }

  if (
    response.status !== 200
    || body.success !== true
    || !body.data
    || typeof body.data.token !== 'string'
    || body.data.token.length === 0
    || body.data.tokenType !== 'Bearer'
  ) {
    fail(`Login contract failed (HTTP ${response.status}).`);
  }

  return body.data.token;
}

export function measuredGet(path, endpoint, token) {
  const headers = { Accept: 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = http.get(`${BASE_URL}${path}`, {
    headers,
    tags: { name: endpoint, endpoint, measured: 'true' },
    responseCallback: http.expectedStatuses(200),
  });

  recordMeasuredResponse(response, endpoint);
  validatePagedApiResponse(response, endpoint);
}

export function validatePagedApiResponse(response, endpoint) {
  let parsed;
  let validJson = true;
  try {
    parsed = response.json();
  } catch (error) {
    validJson = false;
  }

  const results = {
    [`${endpoint}: expected HTTP 200`]: response.status === 200,
    [`${endpoint}: valid JSON`]: validJson,
    [`${endpoint}: successful API envelope`]: validJson
      && parsed !== null
      && typeof parsed === 'object'
      && parsed.success === true
      && typeof parsed.message === 'string'
      && Object.prototype.hasOwnProperty.call(parsed, 'errorCode')
      && parsed.data !== null
      && typeof parsed.data === 'object',
    [`${endpoint}: expected page structure`]: validJson
      && parsed
      && parsed.data
      && Array.isArray(parsed.data.items)
      && Number.isInteger(parsed.data.page)
      && Number.isInteger(parsed.data.size)
      && Number.isInteger(parsed.data.totalItems)
      && Number.isInteger(parsed.data.totalPages),
    [`${endpoint}: non-empty page content`]: validJson
      && parsed
      && parsed.data
      && Array.isArray(parsed.data.items)
      && parsed.data.items.length > 0,
    [`${endpoint}: no authentication error`]: response.status !== 401
      && response.status !== 403
      && (!validJson || !parsed || !['UNAUTHORIZED', 'ACCESS_DENIED'].includes(parsed.errorCode)),
  };

  Object.entries(results).forEach(([name, passed]) => {
    check(response, { [name]: () => passed }, { endpoint, measured: 'true' });
    recordCheckResult(passed, endpoint);
  });
}

export function writeSummary(data) {
  const resultDirectory = __ENV.RESULT_DIRECTORY || 'performance/results/baseline/unassigned/k6';
  const sanitizedData = { ...data };
  delete sanitizedData.setup_data;
  return {
    stdout: `${compactSummary(data)}\n`,
    [`${resultDirectory}/summary.json`]: JSON.stringify(sanitizedData, null, 2),
  };
}

function compactSummary(data) {
  const duration = data.metrics['http_req_duration{measured:true}'];
  const failures = data.metrics['failed_checks'];
  const requests = data.metrics['http_reqs{measured:true}'];
  const bytes = data.metrics['response_body_bytes'];
  return JSON.stringify({
    measuredRequests: requests ? requests.values.count : 0,
    throughputPerSecond: requests ? requests.values.rate : 0,
    p50Ms: duration ? duration.values['p(50)'] : null,
    p95Ms: duration ? duration.values['p(95)'] : null,
    p99Ms: duration ? duration.values['p(99)'] : null,
    responseBodyBytesAverage: bytes ? bytes.values.avg : null,
    failedChecks: failures ? failures.values.count : 0,
    smokeOnly: __ENV.WORKLOAD_KIND === 'smoke',
  });
}

function positiveInteger(raw, fallback, name) {
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    fail(`${name} must be a positive integer.`);
  }
  return value;
}
