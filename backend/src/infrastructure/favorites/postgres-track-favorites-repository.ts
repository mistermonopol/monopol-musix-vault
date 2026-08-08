import type { Sql } from 'postgres';

import type { TrackFavoritesRepository } from '../../application/track-favorites.js';
import type { CatalogArtist, CatalogGenre, CatalogTrack } from '../../domain/catalog.js';
import type { TrackFavorite } from '../../domain/track-favorite.js';

interface FavoriteRow {
  readonly album_id: string | null;
  readonly album_title: string | null;
  readonly artists: CatalogArtist[];
  readonly codec: string | null;
  readonly duration_seconds: number | null;
  readonly favorited_at: Date;
  readonly genres: CatalogGenre[];
  readonly has_artwork: boolean;
  readonly id: string;
  readonly title: string;
  readonly year: number | null;
}

export class PostgresTrackFavoritesRepository implements TrackFavoritesRepository {
  public constructor(private readonly sql: Sql) {}

  public async findByUserId(userId: string): Promise<readonly TrackFavorite[]> {
    const rows = await this.sql<FavoriteRow[]>`
      ${favoriteSelect(this.sql)}
      WHERE favorite.user_id = ${userId}
        AND track.available = true
      ORDER BY favorite.created_at DESC, track.id
    `;
    return rows.map(toTrackFavorite);
  }

  public async remove(userId: string, trackId: string): Promise<void> {
    await this.sql`
      DELETE FROM user_track_favorites
      WHERE user_id = ${userId} AND track_id = ${trackId}
    `;
  }

  public async set(userId: string, trackId: string): Promise<TrackFavorite | null> {
    const rows = await this.sql<FavoriteRow[]>`
      WITH selected_track AS (
        SELECT id FROM tracks WHERE id = ${trackId} AND available = true
      ), inserted AS (
        INSERT INTO user_track_favorites (user_id, track_id)
        SELECT ${userId}, id FROM selected_track
        ON CONFLICT (user_id, track_id) DO NOTHING
      )
      ${favoriteSelect(this.sql)}
      WHERE favorite.user_id = ${userId}
        AND favorite.track_id = ${trackId}
        AND track.available = true
    `;
    const row = rows[0];
    return row === undefined ? null : toTrackFavorite(row);
  }
}

function favoriteSelect(sql: Sql) {
  return sql`
    SELECT
      favorite.created_at AS favorited_at,
      track.id,
      track.title,
      track.year,
      track.duration_seconds,
      track.codec,
      artwork.track_id IS NOT NULL AS has_artwork,
      album.id AS album_id,
      album.title AS album_title,
      COALESCE(track_artist_list.artists, '[]'::jsonb) AS artists,
      COALESCE(track_genre_list.genres, '[]'::jsonb) AS genres
    FROM user_track_favorites AS favorite
    JOIN tracks AS track ON track.id = favorite.track_id
    LEFT JOIN albums AS album ON album.id = track.album_id
    LEFT JOIN track_artwork AS artwork ON artwork.track_id = track.id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object('id', artist.id, 'name', artist.name)
        ORDER BY track_artist.position, artist.id
      ) AS artists
      FROM track_artists AS track_artist
      JOIN artists AS artist ON artist.id = track_artist.artist_id
      WHERE track_artist.track_id = track.id
    ) AS track_artist_list ON true
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(
        jsonb_build_object('id', genre.id, 'name', genre.name)
        ORDER BY lower(genre.name), genre.id
      ) AS genres
      FROM track_genres AS track_genre
      JOIN genres AS genre ON genre.id = track_genre.genre_id
      WHERE track_genre.track_id = track.id
    ) AS track_genre_list ON true
  `;
}

function toTrackFavorite(row: FavoriteRow): TrackFavorite {
  const track: CatalogTrack = {
    album: row.album_id === null || row.album_title === null
      ? null
      : { id: row.album_id, title: row.album_title },
    artists: row.artists,
    codec: row.codec,
    durationSeconds: row.duration_seconds,
    genres: row.genres,
    hasArtwork: row.has_artwork,
    id: row.id,
    title: row.title,
    year: row.year,
  };
  return { favoritedAt: row.favorited_at, track };
}
