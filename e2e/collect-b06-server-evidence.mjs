import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { root, readLocal, writeLocal } from './helpers.mjs';

const input = process.argv[2] || 'b06-diagnostic-evidence.json';
const output = process.argv[3] || 'b06-server-evidence.json';
const evidence = readLocal(input);
const ids = new Set(evidence.modes.flatMap(m => m.responses).map(r => r.requestId).filter(Boolean));
const logs = execFileSync('docker', ['compose', 'logs', '--since', evidence.startedAt, 'backend'], { cwd: path.join(root, '..'), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const rows = [];
for (const line of logs.split(/\r?\n/)) {
  const match = line.match(/requestId=([0-9a-f-]{36}) method=(\w+) path=(\S+) status=(\d+) durationMs=(\d+)/i);
  if (match && ids.has(match[1])) rows.push({ requestId: match[1], method: match[2], path: match[3], status: Number(match[4]), durationMs: Number(match[5]) });
}
const found = new Set(rows.map(r => r.requestId));
const result = { capturedRequestIds: ids.size, matched: found.size, unmatched: [...ids].filter(id => !found.has(id)), rows };
writeLocal(output, result);
console.log(JSON.stringify({ capturedRequestIds: ids.size, matched: found.size, unmatched: result.unmatched.length, statuses: [...new Set(rows.map(r => r.status))] }));
