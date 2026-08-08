import { describe, expect, it } from 'vitest';

import {
  TrackFavoritesService,
  TrackNotFoundError,
  type TrackFavoritesRepository,
} from '../src/application/track-favorites.js';
import type { TrackFavorite } from '../src/domain/track-favorite.js';

const favorite: TrackFavorite = {
  favoritedAt: new Date('2026-08-08T12:00:00.000Z'),
  track: {
    album: null,
    artists: [],
    codec: 'flac',
    durationSeconds: 180,
    genres: [],
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Favorite track',
    year: 2026,
  },
};

class FakeTrackFavoritesRepository implements TrackFavoritesRepository {
  public removed: { trackId: string; userId: string } | null = null;
  public result: TrackFavorite | null = favorite;

  public async findByUserId(): Promise<readonly TrackFavorite[]> {
    return [favorite];
  }

  public async remove(userId: string, trackId: string): Promise<void> {
    this.removed = { trackId, userId };
  }

  public async set(): Promise<TrackFavorite | null> {
    return this.result;
  }
}

describe('TrackFavoritesService', () => {
  it('returns the user favorites', async () => {
    const service = new TrackFavoritesService(new FakeTrackFavoritesRepository());

    await expect(service.list('user-1')).resolves.toEqual([favorite]);
  });

  it('sets an existing track favorite idempotently', async () => {
    const service = new TrackFavoritesService(new FakeTrackFavoritesRepository());

    await expect(service.set('user-1', favorite.track.id)).resolves.toBe(favorite);
  });

  it('rejects a missing or unavailable track', async () => {
    const repository = new FakeTrackFavoritesRepository();
    repository.result = null;
    const service = new TrackFavoritesService(repository);

    await expect(service.set('user-1', favorite.track.id)).rejects.toBeInstanceOf(
      TrackNotFoundError,
    );
  });

  it('delegates removal without requiring an existing favorite', async () => {
    const repository = new FakeTrackFavoritesRepository();
    const service = new TrackFavoritesService(repository);

    await service.remove('user-1', favorite.track.id);

    expect(repository.removed).toEqual({ trackId: favorite.track.id, userId: 'user-1' });
  });
});
