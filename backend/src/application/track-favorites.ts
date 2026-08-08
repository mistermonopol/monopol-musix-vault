import type { TrackFavorite } from '../domain/track-favorite.js';

export interface TrackFavoritesRepository {
  findByUserId(userId: string): Promise<readonly TrackFavorite[]>;
  remove(userId: string, trackId: string): Promise<void>;
  set(userId: string, trackId: string): Promise<TrackFavorite | null>;
}

export class TrackNotFoundError extends Error {
  public constructor() {
    super('Track not found');
    this.name = 'TrackNotFoundError';
  }
}

export interface TrackFavoritesOperations {
  list(userId: string): Promise<readonly TrackFavorite[]>;
  remove(userId: string, trackId: string): Promise<void>;
  set(userId: string, trackId: string): Promise<TrackFavorite>;
}

export class TrackFavoritesService implements TrackFavoritesOperations {
  public constructor(private readonly repository: TrackFavoritesRepository) {}

  public list(userId: string): Promise<readonly TrackFavorite[]> {
    return this.repository.findByUserId(userId);
  }

  public remove(userId: string, trackId: string): Promise<void> {
    return this.repository.remove(userId, trackId);
  }

  public async set(userId: string, trackId: string): Promise<TrackFavorite> {
    const favorite = await this.repository.set(userId, trackId);
    if (favorite === null) throw new TrackNotFoundError();
    return favorite;
  }
}
