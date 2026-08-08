import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: { id: 'user-id', email: 'listener@example.com' },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function loadApi() {
  vi.resetModules();
  return import('./api');
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('access code lifecycle', () => {
  it('sends the code during authentication and stores it only after success', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ error: 'Denied' }, 401))
      .mockResolvedValueOnce(jsonResponse(session));
    const api = await loadApi();

    await expect(api.authenticate('login', 'listener@example.com', 'long-enough-password', 'wrong-code'))
      .rejects.toMatchObject({ status: 401 });
    expect(sessionStorage.getItem('mmv.access-code')).toBeNull();

    await api.authenticate('login', 'listener@example.com', 'long-enough-password', 'right-code');
    const firstHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    const secondHeaders = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(firstHeaders.get('X-Access-Code')).toBe('wrong-code');
    expect(secondHeaders.get('X-Access-Code')).toBe('right-code');
    expect(sessionStorage.getItem('mmv.access-code')).toBe('right-code');
    expect(localStorage.getItem('mmv.access-code')).toBeNull();
  });

  it('injects the session code into refresh and normal API requests', async () => {
    localStorage.setItem('mmv.refresh-token', 'saved-refresh');
    sessionStorage.setItem('mmv.access-code', 'tab-code');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(jsonResponse({ items: [], total: 0 }));
    const api = await loadApi();

    await api.refreshSession();
    await api.listTracks('', 25, 0);

    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('X-Access-Code')).toBe('tab-code');
    expect(new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get('X-Access-Code')).toBe('tab-code');
  });

  it('does not attempt restoration or delete the refresh token without a session code', async () => {
    localStorage.setItem('mmv.refresh-token', 'saved-refresh');
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const api = await loadApi();

    expect(api.hasSavedSession()).toBe(false);
    await expect(api.refreshSession()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('mmv.refresh-token')).toBe('saved-refresh');
  });

  it('lists and updates synchronized favorites with both auth layers', async () => {
    localStorage.setItem('mmv.refresh-token', 'saved-refresh');
    sessionStorage.setItem('mmv.access-code', 'tab-code');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(session))
      .mockResolvedValueOnce(jsonResponse({ items: [{ track: { id: 'track-id' } }] }))
      .mockResolvedValueOnce(jsonResponse({ favorite: { track: { id: 'track-id' } } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = await loadApi();
    await api.refreshSession();

    expect(await api.listFavoriteTrackIds()).toEqual(new Set(['track-id']));
    await api.setTrackFavorite('track-id', true);
    await api.setTrackFavorite('track-id', false);

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/favorites/tracks');
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe('PUT');
    expect(fetchMock.mock.calls[3]?.[1]?.method).toBe('DELETE');
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('Authorization')).toBe('Bearer access-token');
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('X-Access-Code')).toBe('tab-code');
  });

  it('clears the session code on logout', async () => {
    localStorage.setItem('mmv.refresh-token', 'saved-refresh');
    sessionStorage.setItem('mmv.access-code', 'tab-code');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    const api = await loadApi();

    await api.logout();

    expect(sessionStorage.getItem('mmv.access-code')).toBeNull();
    expect(localStorage.getItem('mmv.refresh-token')).toBeNull();
  });
});

describe('user data API', () => {
  async function authenticatedApi(responses: readonly Response[]) {
    localStorage.setItem('mmv.refresh-token', 'saved-refresh');
    sessionStorage.setItem('mmv.access-code', 'tab-code');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(session));
    responses.forEach((response) => fetchMock.mockResolvedValueOnce(response));
    const api = await loadApi();
    await api.refreshSession();
    return { api, fetchMock };
  }

  it('records listening events and positions with encoded track IDs', async () => {
    const position = { positionSeconds: 12, trackId: 'track/id', updatedAt: '2026-01-01' };
    const { api, fetchMock } = await authenticatedApi([
      jsonResponse({ event: { id: 'event-id' } }, 201), jsonResponse({ position }), jsonResponse({ position }),
    ]);
    await api.addListeningEvent('track/id', 'paused', 12);
    expect(await api.getListeningPosition('track/id')).toEqual(position);
    await api.saveListeningPosition('track/id', 15);

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/listening/events');
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ eventType: 'paused', positionSeconds: 12, trackId: 'track/id' }));
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/listening/positions/track%2Fid');
    expect(fetchMock.mock.calls[3]?.[1]?.method).toBe('PUT');
  });

  it('treats a missing listening position and queue as empty state', async () => {
    const { api } = await authenticatedApi([jsonResponse({ error: 'missing' }, 404), jsonResponse({ error: 'missing' }, 404)]);
    await expect(api.getListeningPosition('track-id')).resolves.toBeNull();
    await expect(api.getQueue('device-id')).resolves.toBeNull();
  });

  it('uses playlist CRUD and item replacement contracts', async () => {
    const playlist = { id: 'p1', name: 'Mix', description: '', items: [], createdAt: '', updatedAt: '' };
    const { api, fetchMock } = await authenticatedApi([jsonResponse({ items: [playlist] }), jsonResponse({ playlist }, 201), jsonResponse({ playlist }), jsonResponse({ playlist }), new Response(null, { status: 204 })]);
    await api.listPlaylists(); await api.createPlaylist('Mix'); await api.updatePlaylist('p1', 'New'); await api.replacePlaylistItems('p1', ['t1']); await api.deletePlaylist('p1');
    expect(fetchMock.mock.calls.slice(1).map((call) => [call[0], call[1]?.method ?? 'GET'])).toEqual([
      ['/api/playlists', 'GET'], ['/api/playlists', 'POST'], ['/api/playlists/p1', 'PATCH'], ['/api/playlists/p1/items', 'PUT'], ['/api/playlists/p1', 'DELETE'],
    ]);
  });

  it('gets and starts admin artwork lookup with the retry option', async () => {
    const progress = { attempted: 0, coversApplied: 0, errors: [], failed: 0, finishedAt: null, matched: 0, noCover: 0, noMatch: 0, queued: 3, startedAt: '2026-08-08T12:00:00.000Z', state: 'running', tracksUpdated: 0 };
    const { api, fetchMock } = await authenticatedApi([jsonResponse(progress), jsonResponse(progress, 202)]);

    await expect(api.getArtworkLookupStatus()).resolves.toEqual(progress);
    await expect(api.startArtworkLookup(true)).resolves.toEqual(progress);

    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/admin/artwork/lookup');
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBeUndefined();
    expect(fetchMock.mock.calls[2]?.[0]).toBe('/api/admin/artwork/lookup');
    expect(fetchMock.mock.calls[2]?.[1]?.method).toBe('POST');
    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(JSON.stringify({ retry: true }));
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('Authorization')).toBe('Bearer access-token');
  });

  it('transfers a queue without requesting autoplay and loads the graph', async () => {
    const queue = { deviceId: 'target', items: ['track'], currentIndex: 0, positionSeconds: 3, updatedAt: '' };
    const graph = { nodes: [{ id: 'track:1', label: 'One', type: 'track', properties: { album: 'First', year: 2026 } }], edges: [] };
    const { api, fetchMock } = await authenticatedApi([jsonResponse({ autoPlay: false, queue }), jsonResponse(graph)]);
    await expect(api.transferQueue('source', 'target')).resolves.toMatchObject({ autoPlay: false });
    await expect(api.getBrainGraph()).resolves.toEqual(graph);
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ sourceDeviceId: 'source', targetDeviceId: 'target' }));
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get('Authorization')).toBe('Bearer access-token');
  });

  it('loads artwork as an authenticated blob and handles missing artwork', async () => {
    const image = new Blob(['image'], { type: 'image/jpeg' });
    const { api, fetchMock } = await authenticatedApi([new Response(image, { headers: { 'Content-Type': 'image/jpeg' } }), jsonResponse({ error: 'missing' }, 404)]);
    await expect(api.getTrackArtwork('track/id')).resolves.toMatchObject({ type: 'image/jpeg' });
    await expect(api.getTrackArtwork('missing')).resolves.toBeNull();
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/tracks/track%2Fid/artwork');
    const headers = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer access-token');
    expect(headers.get('X-Access-Code')).toBe('tab-code');
  });
});
