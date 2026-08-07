import type { AuthSession, BrainSyncResult, ScanResult, Track, TrackPage } from './types';

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

export function scanLibrary(): Promise<ScanResult> {
  return request<ScanResult>('/library/scan', { method: 'POST' });
}

export function syncObsidianBrain(): Promise<BrainSyncResult> {
  return request<BrainSyncResult>('/brain/sync', { method: 'POST' });
}

export function hasSavedSession(): boolean {
  return localStorage.getItem(REFRESH_KEY) !== null
    && sessionStorage.getItem(ACCESS_CODE_KEY) !== null;
}

export function subscribeToSession(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}
