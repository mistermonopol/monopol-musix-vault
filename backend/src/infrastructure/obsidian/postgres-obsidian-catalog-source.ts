import type { Sql } from 'postgres';

import type { ObsidianCatalogSource } from '../../application/obsidian/sync-catalog.js';
import type { ObsidianCatalogTrack, ObsidianNamedEntity } from '../../domain/obsidian/catalog.js';

interface TrackRow {
  readonly album_id: string | null;
  readonly album_title: string | null;
  readonly artists: ObsidianNamedEntity[];
  readonly codec: string | null;
  readonly duration_seconds: number | null;
  readonly genres: ObsidianNamedEntity[];
  readonly id: string;
  readonly title: string;
  readonly year: number | null;
}

export class PostgresObsidianCatalogSource implements ObsidianCatalogSource {
  public constructor(private readonly sql: Sql) {}

  public async findAllAvailableTracks(): Promise<readonly ObsidianCatalogTrack[]> {
    const rows = await this.sql<TrackRow[]>`
      SELECT track.id, track.title, track.year, track.duration_seconds, track.codec,
        album.id AS album_id, album.title AS album_title,
        COALESCE(artist_list.items, '[]'::jsonb) AS artists,
        COALESCE(genre_list.items, '[]'::jsonb) AS genres
      FROM tracks AS track
      LEFT JOIN albums AS album ON album.id = track.album_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('id', artist.id, 'name', artist.name)
          ORDER BY track_artist.position, artist.id) AS items
        FROM track_artists AS track_artist
        JOIN artists AS artist ON artist.id = track_artist.artist_id
        WHERE track_artist.track_id = track.id
      ) AS artist_list ON true
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('id', genre.id, 'name', genre.name)
          ORDER BY lower(genre.name), genre.id) AS items
        FROM track_genres AS track_genre
        JOIN genres AS genre ON genre.id = track_genre.genre_id
        WHERE track_genre.track_id = track.id
      ) AS genre_list ON true
      WHERE track.available = true
      ORDER BY lower(track.title), track.id
    `;

    return rows.map((row) => ({
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
    }));
  }
}
