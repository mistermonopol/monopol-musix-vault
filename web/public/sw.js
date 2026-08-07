let accessToken = null;
let tokenVersion = 0;
const tokenWaiters = new Set();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  await self.clients.claim();
  await requestTokenFromClients();
})()));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_AUTH_TOKEN' && typeof event.data.token === 'string') {
    accessToken = event.data.token;
    tokenVersion += 1;
    resolveTokenWaiters();
  }
  if (event.data?.type === 'CLEAR_AUTH_TOKEN') {
    accessToken = null;
    tokenVersion += 1;
    resolveTokenWaiters();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/api/tracks/')) return;
  event.respondWith(authenticatedTrackRequest(event.request));
});

async function authenticatedTrackRequest(request) {
  if (accessToken === null) {
    const previousVersion = tokenVersion;
    await requestTokenFromClients();
    await waitForTokenUpdate(previousVersion);
  }

  const firstResponse = await fetchWithCurrentToken(request);
  if (firstResponse.status !== 401) return firstResponse;

  await firstResponse.body?.cancel();
  const previousVersion = tokenVersion;
  await requestTokenFromClients(true);
  const refreshed = await waitForTokenUpdate(previousVersion);
  if (!refreshed || accessToken === null) return firstResponse;

  return fetchWithCurrentToken(request);
}

function fetchWithCurrentToken(request) {
  const headers = new Headers(request.headers);
  if (accessToken !== null) headers.set('Authorization', `Bearer ${accessToken}`);
  return fetch(new Request(request, { headers }));
}

async function requestTokenFromClients(refresh = false) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({
    type: refresh ? 'AUTH_REQUIRED' : 'AUTH_TOKEN_REQUEST',
  }));
}

function waitForTokenUpdate(previousVersion) {
  if (tokenVersion !== previousVersion) return Promise.resolve(true);
  return new Promise((resolve) => {
    const waiter = { previousVersion, resolve };
    tokenWaiters.add(waiter);
    setTimeout(() => {
      if (tokenWaiters.delete(waiter)) resolve(false);
    }, 10_000);
  });
}

function resolveTokenWaiters() {
  for (const waiter of tokenWaiters) {
    if (tokenVersion !== waiter.previousVersion) {
      tokenWaiters.delete(waiter);
      waiter.resolve(true);
    }
  }
}
