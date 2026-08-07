import assert from 'node:assert/strict';

const baseUrl = process.env.API_URL ?? 'http://127.0.0.1:3000';
const accessCode = process.env.API_ACCESS_CODE;
assert.equal(typeof accessCode, 'string', 'API_ACCESS_CODE is required');
const trackId = '00000000-0000-4000-8000-000000000007';
const bootstrap = await fetch(`${baseUrl}/auth/bootstrap`, {
  body: JSON.stringify({ email: 'streamer@example.com', password: 'a-secure-test-password' }),
  headers: {
    'content-type': 'application/json',
    'x-access-code': accessCode,
  },
  method: 'POST',
});
assert.equal(bootstrap.status, 201);
const authenticated = await bootstrap.json();

const deniedProfile = await fetch(`${baseUrl}/auth/me`, {
  headers: { authorization: `Bearer ${authenticated.accessToken}` },
});
assert.equal(deniedProfile.status, 403);
const profile = await fetch(`${baseUrl}/auth/me`, {
  headers: {
    authorization: `Bearer ${authenticated.accessToken}`,
    'x-access-code': accessCode,
  },
});
assert.equal(profile.status, 200);

const streamCookie = bootstrap.headers.get('set-cookie')?.split(';', 1)[0];
assert.equal(typeof streamCookie, 'string');
const url = `${baseUrl}/tracks/${trackId}/stream`;
const cookieHeader = { cookie: streamCookie };

assert.equal((await fetch(url)).status, 401);

const head = await fetch(url, {
  headers: { ...cookieHeader, authorization: 'Bearer stale-legacy-token' },
  method: 'HEAD',
});
assert.equal(head.status, 200);
assert.equal(head.headers.get('accept-ranges'), 'bytes');
assert.equal(head.headers.get('content-type'), 'audio/wav');
assert.equal(head.headers.get('content-length'), '8044');

const full = await fetch(url, { headers: cookieHeader });
assert.equal(full.status, 200);
assert.equal((await full.arrayBuffer()).byteLength, 8044);

const partial = await fetch(url, { headers: { ...cookieHeader, range: 'bytes=0-9' } });
assert.equal(partial.status, 206);
assert.equal(partial.headers.get('content-range'), 'bytes 0-9/8044');
assert.equal(partial.headers.get('content-length'), '10');
assert.equal((await partial.arrayBuffer()).byteLength, 10);

const suffix = await fetch(url, { headers: { ...cookieHeader, range: 'bytes=-8' } });
assert.equal(suffix.status, 206);
assert.equal(suffix.headers.get('content-range'), 'bytes 8036-8043/8044');
assert.equal((await suffix.arrayBuffer()).byteLength, 8);

const malformed = await fetch(url, { headers: { ...cookieHeader, range: 'items=0-1' } });
assert.equal(malformed.status, 400);

const unsatisfiable = await fetch(url, {
  headers: { ...cookieHeader, range: 'bytes=9000-' },
});
assert.equal(unsatisfiable.status, 416);
assert.equal(unsatisfiable.headers.get('content-range'), 'bytes */8044');

console.log('Audio streaming end-to-end flow passed');
