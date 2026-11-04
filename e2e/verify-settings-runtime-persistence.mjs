import assert from 'node:assert/strict';
import { login, ok, readLocal, writeLocal } from './helpers.mjs';
const data = {};
for (const alias of ['student', 'company', 'studentUi', 'companyUi', 'frontend']) {
  const token = await login(alias);
  data[alias] = {
    account: await ok('GET', alias.startsWith('company') ? '/companies/me' : '/students/me', token),
    preferences: await ok('GET', '/users/me/notification-settings', token),
    notifications: await ok('GET', '/notifications?size=100', token),
    unread: await ok('GET', '/notifications/unread-count', token),
  };
}
const filename = 'settings-before-recreate.json';
if (process.argv.includes('--capture')) {
  try { readLocal(filename); throw new Error('Do not overwrite a settings persistence baseline.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  writeLocal(filename, data);
  console.log('Captured five account/preference/inbox/unread snapshots before Backend recreate.');
} else {
  const before = readLocal(filename);
  const checks = Object.fromEntries(Object.keys(before).map(alias => [alias, JSON.stringify(before[alias]) === JSON.stringify(data[alias])]));
  writeLocal('settings-runtime-persistence.json', { checkedAt: new Date().toISOString(), exactSnapshots: checks });
  console.log(JSON.stringify(checks));
  assert.ok(Object.values(checks).every(Boolean), 'Settings/inbox snapshots differ after recreate; inspect local files.');
}
