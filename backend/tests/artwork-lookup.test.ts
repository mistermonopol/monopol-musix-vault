import { describe, expect, it, vi } from 'vitest';

import { ArtworkLookupInProgressError, ArtworkLookupService, isConservativeMatch, type ArtworkLookupRepository, type MissingArtworkAlbum } from '../src/application/artwork-lookup.js';
import { MusicBrainzHttpArtworkProvider } from '../src/infrastructure/musicbrainz/musicbrainz-artwork-provider.js';

const album: MissingArtworkAlbum = { albumArtist: 'Björk', albumId: 'album-1', title: 'Debut', year: 1993 };

describe('ArtworkLookupService', () => {
  it('matches only high-scoring exact normalized album metadata', () => {
    expect(isConservativeMatch(album, { artist: 'BJÖRK', id: 'mbid', score: 90, title: ' debut ', year: 1993 })).toBe(true);
    expect(isConservativeMatch(album, { artist: 'Björk', id: 'mbid', score: 89, title: 'Debut', year: 1993 })).toBe(false);
    expect(isConservativeMatch(album, { artist: 'Björk', id: 'mbid', score: 100, title: 'Post', year: 1995 })).toBe(false);
  });

  it('runs once in the background, applies one cover to missing album tracks, and caches success', async () => {
    let releaseList: (value: readonly MissingArtworkAlbum[]) => void = () => undefined;
    const pending = new Promise<readonly MissingArtworkAlbum[]>((resolve) => { releaseList = resolve; });
    const attempts: string[] = [];
    const repository: ArtworkLookupRepository = {
      listMissingAlbums: async () => pending,
      recordAttempt: async (_id, status) => { attempts.push(status); },
      saveAlbumArtwork: async () => 3,
    };
    const service = new ArtworkLookupService(repository, {
      findReleaseGroup: async () => ({ artist: 'Björk', id: '00000000-0000-4000-8000-000000000001', score: 100, title: 'Debut', year: 1993 }),
      fetchFrontCover: async () => ({ data: Buffer.from([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg' }),
    }, true, 10, () => new Date('2026-01-01T00:00:00Z'));

    expect(service.start({ retry: false }).state).toBe('running');
    expect(() => service.start({ retry: false })).toThrow(ArtworkLookupInProgressError);
    releaseList([album]);
    await vi.waitFor(() => expect(service.status().state).toBe('completed'));
    expect(service.status()).toMatchObject({ attempted: 1, coversApplied: 1, matched: 1, tracksUpdated: 3 });
    expect(attempts).toEqual(['success']);
  });
});

describe('MusicBrainzHttpArtworkProvider', () => {
  it('uses the configured UA, throttles searches, selects a later exact candidate, and accepts a safe JPEG redirect', async () => {
    const sleeps: number[] = [];
    const requests: { redirect: RequestInit['redirect']; url: string; userAgent: string | null }[] = [];
    let clock = 1000;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ redirect: init?.redirect, url, userAgent: new Headers(init?.headers).get('User-Agent') });
      if (url.includes('musicbrainz.org')) return new Response(JSON.stringify({ 'release-groups': [
        { 'artist-credit': [{ name: 'Björk' }], 'first-release-date': '1995-06-13', id: '00000000-0000-4000-8000-000000000002', score: 100, title: 'Post' },
        { 'artist-credit': [{ name: 'Björk' }], 'first-release-date': '1993-07-05', id: '00000000-0000-4000-8000-000000000001', score: 99, title: 'Debut' },
      ] }), { headers: { 'content-type': 'application/json' } });
      if (url.includes('coverartarchive.org')) return new Response(null, { headers: { location: 'https://ia800.example.archive.org/cover.jpg' }, status: 302 });
      return new Response(Buffer.from([0xff, 0xd8, 0xff, 0x00]), { headers: { 'content-type': 'image/jpeg' } });
    });
    const provider = new MusicBrainzHttpArtworkProvider('Vault/1.0 (admin@example.com)', 1100, 5000, fetchMock as typeof fetch, async (ms) => { sleeps.push(ms); clock += ms; }, () => clock);

    expect(await provider.findReleaseGroup(album)).toMatchObject({ id: '00000000-0000-4000-8000-000000000001', score: 99 });
    await provider.findReleaseGroup(album);
    expect(sleeps).toEqual([1100]);
    expect((await provider.fetchFrontCover('00000000-0000-4000-8000-000000000001'))?.mimeType).toBe('image/jpeg');
    expect(requests.every((request) => request.userAgent === 'Vault/1.0 (admin@example.com)')).toBe(true);
    expect(requests.at(-2)?.redirect).toBe('manual');
  });

  it('applies one timeout deadline across cover redirects', async () => {
    const requests = vi.fn(async () => new Response(null, { headers: { location: 'https://archive.org/next.jpg' }, status: 302 }));
    const times = [0, 0, 5001];
    const provider = new MusicBrainzHttpArtworkProvider(
      'Vault/1.0 (admin@example.com)', 1100, 5000, requests as typeof fetch,
      undefined, () => times.shift() ?? 5001,
    );

    await expect(provider.fetchFrontCover('id')).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(requests).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe redirects and mismatched image signatures', async () => {
    const unsafe = new MusicBrainzHttpArtworkProvider('Vault/1.0 (admin@example.com)', 1100, 5000, vi.fn(async () => new Response(null, { headers: { location: 'http://evil.example/cover.jpg' }, status: 302 })) as typeof fetch);
    await expect(unsafe.fetchFrontCover('id')).rejects.toThrow('Unsafe cover redirect');

    const invalid = new MusicBrainzHttpArtworkProvider('Vault/1.0 (admin@example.com)', 1100, 5000, vi.fn(async () => new Response(Buffer.from('not jpeg'), { headers: { 'content-type': 'image/jpeg' } })) as typeof fetch);
    await expect(invalid.fetchFrontCover('id')).rejects.toThrow('signature');
  });
});
