import { Counter, Rate, Trend } from 'k6/metrics';

export const responseBodyBytes = new Trend('response_body_bytes');
export const measuredRequests = new Counter('measured_requests');
export const failedChecks = new Counter('failed_checks');
export const correctnessErrorRate = new Rate('correctness_error_rate');

export function recordMeasuredResponse(response, endpoint) {
  const tags = { endpoint, measured: 'true' };
  responseBodyBytes.add(utf8ByteLength(response.body || ''), tags);
  measuredRequests.add(1, tags);
}

export function recordCheckResult(passed, endpoint) {
  const tags = { endpoint, measured: 'true' };
  correctnessErrorRate.add(!passed, tags);
  if (!passed) {
    failedChecks.add(1, tags);
  }
}

function utf8ByteLength(value) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}
