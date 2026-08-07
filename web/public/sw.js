let tokenVersion = 0;
const tokenWaiters = new Set();

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_AUTH_TOKEN' || event.data?.type === 'CLEAR_AUTH_TOKEN') {
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
  const firstResponse = await fetch(request.clone());
  if (firstResponse.status !== 401) return firstResponse;

  await firstResponse.body?.cancel();
  const previousVersion = tokenVersion;
  await requestRefreshFromClients();
  const refreshed = await waitForTokenUpdate(previousVersion);
  if (!refreshed) return new Response(null, { status: 401 });

  return fetch(request.clone());
}

async function requestRefreshFromClients() {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: 'AUTH_REQUIRED' }));
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
