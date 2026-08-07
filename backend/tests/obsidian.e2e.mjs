import assert from 'node:assert/strict';

const baseUrl = process.env.API_URL ?? 'http://127.0.0.1:3000';
const accessCode = process.env.API_ACCESS_CODE;
assert.equal(typeof accessCode, 'string', 'API_ACCESS_CODE is required');
const commonHeaders = {
  'content-type': 'application/json',
  'x-access-code': accessCode,
};

const bootstrap = await fetch(`${baseUrl}/auth/bootstrap`, {
  body: JSON.stringify({
    email: 'brain@example.com',
    password: 'a-secure-test-password',
  }),
  headers: commonHeaders,
  method: 'POST',
});
assert.equal(bootstrap.status, 201);
const { accessToken } = await bootstrap.json();
const protectedHeaders = {
  authorization: `Bearer ${accessToken}`,
  'x-access-code': accessCode,
};

const scan = await fetch(`${baseUrl}/library/scan`, {
  headers: protectedHeaders,
  method: 'POST',
});
assert.equal(scan.status, 200);
const scanResult = await scan.json();
assert.equal(scanResult.processed, 1);
assert.equal(scanResult.failed, 0);

const denied = await fetch(`${baseUrl}/brain/sync`, {
  headers: { authorization: `Bearer ${accessToken}` },
  method: 'POST',
});
assert.equal(denied.status, 403);

const sync = await fetch(`${baseUrl}/brain/sync`, {
  headers: protectedHeaders,
  method: 'POST',
});
assert.equal(sync.status, 200);
const result = await sync.json();
assert.equal(result.counts.tracks, 1);
assert.equal(result.errors.length, 0);

console.log('Obsidian catalog sync end-to-end flow passed');
