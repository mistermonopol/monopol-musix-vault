import assert from 'node:assert/strict';

const baseUrl = process.env.API_URL ?? 'http://127.0.0.1:3000';
const credentials = {
  email: 'owner@example.com',
  password: 'a-secure-test-password',
};

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options.headers },
  });
}

const bootstrap = await request('/auth/bootstrap', {
  body: JSON.stringify(credentials),
  method: 'POST',
});
assert.equal(bootstrap.status, 201);
const initial = await bootstrap.json();
assert.equal(initial.user.email, credentials.email);
assert.equal(initial.user.role, 'admin');
assert.equal(typeof initial.accessToken, 'string');
assert.equal(typeof initial.refreshToken, 'string');

const duplicate = await request('/auth/bootstrap', {
  body: JSON.stringify(credentials),
  method: 'POST',
});
assert.equal(duplicate.status, 409);

const login = await request('/auth/login', {
  body: JSON.stringify(credentials),
  method: 'POST',
});
assert.equal(login.status, 200);
const loggedIn = await login.json();

const profile = await request('/auth/me', {
  headers: { authorization: `Bearer ${loggedIn.accessToken}` },
});
assert.equal(profile.status, 200);
assert.equal((await profile.json()).user.email, credentials.email);

const refresh = await request('/auth/refresh', {
  body: JSON.stringify({ refreshToken: loggedIn.refreshToken }),
  method: 'POST',
});
assert.equal(refresh.status, 200);
const rotated = await refresh.json();
assert.notEqual(rotated.refreshToken, loggedIn.refreshToken);

const reuse = await request('/auth/refresh', {
  body: JSON.stringify({ refreshToken: loggedIn.refreshToken }),
  method: 'POST',
});
assert.equal(reuse.status, 401);

const logout = await request('/auth/logout', {
  body: JSON.stringify({ refreshToken: rotated.refreshToken }),
  method: 'POST',
});
assert.equal(logout.status, 204);

const afterLogout = await request('/auth/refresh', {
  body: JSON.stringify({ refreshToken: rotated.refreshToken }),
  method: 'POST',
});
assert.equal(afterLogout.status, 401);

console.log('Authentication end-to-end flow passed');
