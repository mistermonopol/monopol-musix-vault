import type { CatalogTrack } from './catalog.js';

export interface TrackFavorite {
  readonly favoritedAt: Date;
  readonly track: CatalogTrack;
}
