import assert from 'node:assert/strict';

const baseUrl = process.env.API_URL ?? 'http://127.0.0.1:3000';
const trackId = '00000000-0000-4000-8000-000000000007';
const bootstrap = await fetch(`${baseUrl}/auth/bootstrap`, {
  body: JSON.stringify({ email: 'streamer@example.com', password: 'a-secure-test-password' }),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
});
assert.equal(bootstrap.status, 201);
const { accessToken } = await bootstrap.json();
const url = `${baseUrl}/tracks/${trackId}/stream`;
const authorization = { authorization: `Bearer ${accessToken}` };

assert.equal((await fetch(url)).status, 401);

const head = await fetch(url, { headers: authorization, method: 'HEAD' });
assert.equal(head.status, 200);
assert.equal(head.headers.get('accept-ranges'), 'bytes');
assert.equal(head.headers.get('content-type'), 'audio/wav');
assert.equal(head.headers.get('content-length'), '8044');

const full = await fetch(url, { headers: authorization });
assert.equal(full.status, 200);
assert.equal((await full.arrayBuffer()).byteLength, 8044);

const partial = await fetch(url, { headers: { ...authorization, range: 'bytes=0-9' } });
assert.equal(partial.status, 206);
assert.equal(partial.headers.get('content-range'), 'bytes 0-9/8044');
assert.equal(partial.headers.get('content-length'), '10');
assert.equal((await partial.arrayBuffer()).byteLength, 10);

const suffix = await fetch(url, { headers: { ...authorization, range: 'bytes=-8' } });
assert.equal(suffix.status, 206);
assert.equal(suffix.headers.get('content-range'), 'bytes 8036-8043/8044');
assert.equal((await suffix.arrayBuffer()).byteLength, 8);

const malformed = await fetch(url, { headers: { ...authorization, range: 'items=0-1' } });
assert.equal(malformed.status, 400);

const unsatisfiable = await fetch(url, {
  headers: { ...authorization, range: 'bytes=9000-' },
});
assert.equal(unsatisfiable.status, 416);
assert.equal(unsatisfiable.headers.get('content-range'), 'bytes */8044');

console.log('Audio streaming end-to-end flow passed');
