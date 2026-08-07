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
