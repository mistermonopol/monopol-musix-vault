import type { AuthSession, BrainGraph, BrainSyncResult, Device, ListeningEventType, ListeningPosition, Playlist, QueueSnapshot, RecentListeningItem, ScanResult, Track, TrackPage } from './types';

const REFRESH_KEY = 'mmv.refresh-token';
const ACCESS_CODE_KEY = 'mmv.access-code';
let accessToken: string | null = null;
let refreshPromise: Promise<AuthSession> | null = null;

type SessionListener = (session: AuthSession | null) => void;
const sessionListeners = new Set<SessionListener>();

export class ApiError extends Error {
  public constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function persistRefreshToken(token: string | null): void {
  if (token === null) localStorage.removeItem(REFRESH_KEY);
  else localStorage.setItem(REFRESH_KEY, token);
}

function publishSession(session: AuthSession | null): void {
  accessToken = session?.accessToken ?? null;
  persistRefreshToken(session?.refreshToken ?? null);
  sessionListeners.forEach((listener) => listener(session));
}

async function parseError(response: Response): Promise<ApiError> {
  let body: { error?: string; code?: string } = {};
  try { body = await response.json() as typeof body; } catch { /* non-JSON response */ }
  return new ApiError(body.error ?? `Request failed (${response.status})`, response.status, body.code);
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
  accessCode = sessionStorage.getItem(ACCESS_CODE_KEY),
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessCode !== null) headers.set('X-Access-Code', accessCode);
  if (accessToken !== null) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`/api${path}`, { ...init, headers });
  if (response.status === 401 && retry && hasSavedSession()) {
    await refreshSession();
    return request<T>(path, init, false);
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function normalizeTrack(value: unknown): Track | null {
  if (typeof value !== 'object' || value === null) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.title !== 'string') return null;
  const metadata = typeof item.metadata === 'object' && item.metadata !== null
    ? item.metadata as Record<string, unknown>
    : item;
  const artists = Array.isArray(metadata.artists)
    ? metadata.artists.flatMap((artist) => {
        if (typeof artist === 'string') return [artist];
        if (typeof artist === 'object' && artist !== null && typeof (artist as { name?: unknown }).name === 'string') {
          return [(artist as { name: string }).name];
        }
        return [];
      })
    : [];
  const albumValue = metadata.album;
  const album = typeof albumValue === 'string'
    ? albumValue
    : typeof albumValue === 'object' && albumValue !== null && typeof (albumValue as { title?: unknown }).title === 'string'
      ? (albumValue as { title: string }).title
      : null;
  return {
    id: item.id,
    title: typeof metadata.title === 'string' ? metadata.title : item.title,
    artists,
    album,
    durationSeconds: typeof metadata.durationSeconds === 'number' ? metadata.durationSeconds : null,
    year: typeof metadata.year === 'number' ? metadata.year : null,
  };
}

export async function authenticate(
  mode: 'login' | 'bootstrap',
  email: string,
  password: string,
  accessCode: string,
): Promise<AuthSession> {
  const session = await request<AuthSession>(`/auth/${mode}`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false, accessCode);
  sessionStorage.setItem(ACCESS_CODE_KEY, accessCode);
  publishSession(session);
  return session;
}

export async function refreshSession(): Promise<AuthSession> {
  if (refreshPromise !== null) return refreshPromise;
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (refreshToken === null) throw new ApiError('No saved session', 401);
  if (sessionStorage.getItem(ACCESS_CODE_KEY) === null) {
    throw new ApiError('Access code required', 401);
  }
  refreshPromise = request<AuthSession>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  }, false).then((session) => {
    publishSession(session);
    return session;
  }).catch((error: unknown) => {
    sessionStorage.removeItem(ACCESS_CODE_KEY);
    publishSession(null);
    throw error;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  try {
    if (refreshToken !== null) await request('/auth/logout', {
      method: 'POST', body: JSON.stringify({ refreshToken }),
    }, false);
  } finally {
    sessionStorage.removeItem(ACCESS_CODE_KEY);
    publishSession(null);
  }
}

export async function listTracks(
  search: string,
  limit: number,
  offset: number,
  signal?: AbortSignal,
): Promise<TrackPage> {
  const query = new URLSearchParams({
    search: search.trim(),
    limit: String(limit),
    offset: String(offset),
  });
  const payload = await request<unknown>(
    `/library/tracks?${query.toString()}`,
    signal === undefined ? {} : { signal },
  );
  const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : null;
  const values = Array.isArray(payload)
    ? payload
    : Array.isArray(record?.items)
      ? record.items
      : Array.isArray(record?.tracks)
        ? record.tracks
        : [];
  const tracks = values.map(normalizeTrack).filter((track): track is Track => track !== null);
  return {
    tracks,
    total: typeof record?.total === 'number' ? record.total : tracks.length,
  };
}

export async function listFavoriteTrackIds(): Promise<ReadonlySet<string>> {
  const payload = await request<unknown>('/favorites/tracks');
  const record = typeof payload === 'object' && payload !== null
    ? payload as Record<string, unknown>
    : null;
  const items = Array.isArray(record?.items) ? record.items : [];
  return new Set(items.flatMap((value) => {
    if (typeof value !== 'object' || value === null) return [];
    const track = (value as Record<string, unknown>).track;
    if (typeof track !== 'object' || track === null) return [];
    const id = (track as Record<string, unknown>).id;
    return typeof id === 'string' ? [id] : [];
  }));
}

export function setTrackFavorite(trackId: string, favorite: boolean): Promise<unknown> {
  return request(`/favorites/tracks/${encodeURIComponent(trackId)}`, {
    method: favorite ? 'PUT' : 'DELETE',
  });
}

export function scanLibrary(): Promise<ScanResult> {
  return request<ScanResult>('/library/scan', { method: 'POST' });
}

export function syncObsidianBrain(): Promise<BrainSyncResult> {
  return request<BrainSyncResult>('/brain/sync', { method: 'POST' });
}

export async function listRecentListening(limit = 25): Promise<readonly RecentListeningItem[]> {
  const payload = await request<{ readonly items: readonly RecentListeningItem[] }>(`/listening/recent?limit=${limit}`);
  return payload.items;
}

export function addListeningEvent(trackId: string, eventType: ListeningEventType, positionSeconds?: number): Promise<unknown> {
  return request('/listening/events', { method: 'POST', body: JSON.stringify({ eventType, positionSeconds, trackId }) });
}

export async function getListeningPosition(trackId: string): Promise<ListeningPosition | null> {
  try {
    const payload = await request<{ readonly position: ListeningPosition }>(`/listening/positions/${encodeURIComponent(trackId)}`);
    return payload.position;
  } catch (error: unknown) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function saveListeningPosition(trackId: string, positionSeconds: number): Promise<ListeningPosition> {
  const payload = await request<{ readonly position: ListeningPosition }>(`/listening/positions/${encodeURIComponent(trackId)}`, { method: 'PUT', body: JSON.stringify({ positionSeconds }) });
  return payload.position;
}

export async function listPlaylists(): Promise<readonly Playlist[]> { return (await request<{ readonly items: readonly Playlist[] }>('/playlists')).items; }
export async function createPlaylist(name: string, description = ''): Promise<Playlist> { return (await request<{ readonly playlist: Playlist }>('/playlists', { method: 'POST', body: JSON.stringify({ description, name }) })).playlist; }
export async function updatePlaylist(id: string, name: string, description = ''): Promise<Playlist> { return (await request<{ readonly playlist: Playlist }>(`/playlists/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ description, name }) })).playlist; }
export async function replacePlaylistItems(id: string, trackIds: readonly string[]): Promise<Playlist> { return (await request<{ readonly playlist: Playlist }>(`/playlists/${encodeURIComponent(id)}/items`, { method: 'PUT', body: JSON.stringify({ trackIds }) })).playlist; }
export function deletePlaylist(id: string): Promise<void> { return request(`/playlists/${encodeURIComponent(id)}`, { method: 'DELETE' }); }

export async function listDevices(): Promise<readonly Device[]> { return (await request<{ readonly items: readonly Device[] }>('/devices')).items; }
export async function registerDevice(name: string, kind: string): Promise<Device> { return (await request<{ readonly device: Device }>('/devices', { method: 'POST', body: JSON.stringify({ kind, name }) })).device; }
export function revokeDevice(id: string): Promise<void> { return request(`/devices/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export async function getQueue(deviceId: string): Promise<QueueSnapshot | null> { try { return (await request<{ readonly queue: QueueSnapshot }>(`/queue/${encodeURIComponent(deviceId)}`)).queue; } catch (error: unknown) { if (error instanceof ApiError && error.status === 404) return null; throw error; } }
export async function saveQueue(deviceId: string, queue: Pick<QueueSnapshot, 'currentIndex' | 'items' | 'positionSeconds'>): Promise<QueueSnapshot> { return (await request<{ readonly queue: QueueSnapshot }>(`/queue/${encodeURIComponent(deviceId)}`, { method: 'PUT', body: JSON.stringify(queue) })).queue; }
export async function transferQueue(sourceDeviceId: string, targetDeviceId: string): Promise<{ readonly autoPlay: false; readonly queue: QueueSnapshot }> { return request('/queue/transfer', { method: 'POST', body: JSON.stringify({ sourceDeviceId, targetDeviceId }) }); }
export function getBrainGraph(): Promise<BrainGraph> { return request<BrainGraph>('/brain/graph'); }

export function hasSavedSession(): boolean {
  return localStorage.getItem(REFRESH_KEY) !== null
    && sessionStorage.getItem(ACCESS_CODE_KEY) !== null;
}

export function subscribeToSession(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}
