import assert from 'node:assert/strict';

const baseUrl = process.env.API_URL ?? 'http://127.0.0.1:3000';
const bootstrap = await fetch(`${baseUrl}/auth/bootstrap`, {
  body: JSON.stringify({
    email: 'scanner@example.com',
    password: 'a-secure-test-password',
  }),
  headers: { 'content-type': 'application/json' },
  method: 'POST',
});
assert.equal(bootstrap.status, 201);
const { accessToken } = await bootstrap.json();

async function scan() {
  const response = await fetch(`${baseUrl}/library/scan`, {
    headers: { authorization: `Bearer ${accessToken}` },
    method: 'POST',
  });
  assert.equal(response.status, 200);
  return response.json();
}

const initial = await scan();
assert.equal(initial.discovered, 1);
assert.equal(initial.processed, 1);
assert.equal(initial.failed, 0);

const incremental = await scan();
assert.equal(incremental.discovered, 1);
assert.equal(incremental.processed, 0);
assert.equal(incremental.unchanged, 1);
assert.equal(incremental.failed, 0);

console.log('Music scanner end-to-end flow passed');
