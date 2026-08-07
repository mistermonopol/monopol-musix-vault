import type { Sql } from 'postgres';

import type {
  CatalogRepository,
  CatalogRepositoryQuery,
  CatalogRepositoryResult,
} from '../../application/catalog-query.js';
import type { CatalogArtist, CatalogGenre, CatalogTrack } from '../../domain/catalog.js';

interface CountRow {
  readonly total: string;
}

interface TrackRow {
  readonly album_id: string | null;
  readonly album_title: string | null;
  readonly artists: CatalogArtist[];
  readonly codec: string | null;
  readonly duration_seconds: number | null;
  readonly genres: CatalogGenre[];
  readonly id: string;
  readonly title: string;
  readonly year: number | null;
}

export class PostgresCatalogRepository implements CatalogRepository {
  public constructor(private readonly sql: Sql) {}

  public async findAvailableTracks(query: CatalogRepositoryQuery): Promise<CatalogRepositoryResult> {
    const [countRows, rows] = await Promise.all([
      this.countAvailableTracks(query.search),
      this.findPage(query),
    ]);
    const countRow = countRows[0];

    return {
      items: rows.map(toCatalogTrack),
      total: countRow === undefined ? 0 : parseCount(countRow.total),
    };
  }

  private countAvailableTracks(search: string | null): Promise<CountRow[]> {
    return this.sql<CountRow[]>`
      SELECT count(*) AS total
      FROM tracks AS track
      LEFT JOIN albums AS album ON album.id = track.album_id
      WHERE track.available = true
        AND (
          ${search}::text IS NULL
          OR track.title ILIKE ('%' || ${search}::text || '%')
          OR album.title ILIKE ('%' || ${search}::text || '%')
          OR EXISTS (
            SELECT 1
            FROM track_artists AS track_artist
            JOIN artists AS artist ON artist.id = track_artist.artist_id
            WHERE track_artist.track_id = track.id
              AND artist.name ILIKE ('%' || ${search}::text || '%')
          )
        )
    `;
  }

  private findPage(query: CatalogRepositoryQuery): Promise<TrackRow[]> {
    return this.sql<TrackRow[]>`
      SELECT
        track.id,
        track.title,
        track.year,
        track.duration_seconds,
        track.codec,
        album.id AS album_id,
        album.title AS album_title,
        COALESCE(track_artist_list.artists, '[]'::jsonb) AS artists,
        COALESCE(track_genre_list.genres, '[]'::jsonb) AS genres
      FROM tracks AS track
      LEFT JOIN albums AS album ON album.id = track.album_id
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
      WHERE track.available = true
        AND (
          ${query.search}::text IS NULL
          OR track.title ILIKE ('%' || ${query.search}::text || '%')
          OR album.title ILIKE ('%' || ${query.search}::text || '%')
          OR EXISTS (
            SELECT 1
            FROM track_artists AS search_track_artist
            JOIN artists AS search_artist ON search_artist.id = search_track_artist.artist_id
            WHERE search_track_artist.track_id = track.id
              AND search_artist.name ILIKE ('%' || ${query.search}::text || '%')
          )
        )
      ORDER BY lower(track.title), track.id
      LIMIT ${query.limit}
      OFFSET ${query.offset}
    `;
  }
}

function toCatalogTrack(row: TrackRow): CatalogTrack {
  return {
    album: row.album_id === null || row.album_title === null
      ? null
      : { id: row.album_id, title: row.album_title },
    artists: row.artists,
    codec: row.codec,
    durationSeconds: row.duration_seconds,
    genres: row.genres,
    id: row.id,
    title: row.title,
    year: row.year,
  };
}

function parseCount(value: string): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new RangeError(`Catalog count is outside the safe integer range: ${value}`);
  }
  return count;
}
