let accessToken = null;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil((async () => {
  await self.clients.claim();
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: 'AUTH_TOKEN_REQUEST' }));
})()));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_AUTH_TOKEN' && typeof event.data.token === 'string') {
    accessToken = event.data.token;
  }
  if (event.data?.type === 'CLEAR_AUTH_TOKEN') accessToken = null;
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/api/tracks/')) return;
  event.respondWith(authenticatedTrackRequest(event.request));
});

async function authenticatedTrackRequest(request) {
  const headers = new Headers(request.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  // Constructing from the original request preserves method, Range, If-Range,
  // credentials, and abort behavior while replacing only the headers.
  const response = await fetch(new Request(request, { headers }));
  if (response.status === 401) {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => client.postMessage({ type: 'AUTH_REQUIRED' }));
  }
  return response;
}
