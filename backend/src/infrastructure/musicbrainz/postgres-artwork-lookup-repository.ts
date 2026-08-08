import type { Sql } from 'postgres';

import type { ArtworkLookupAttemptStatus, ArtworkLookupRepository, DownloadedArtwork, MissingArtworkAlbum, MusicBrainzMatch } from '../../application/artwork-lookup.js';

interface AlbumRow { readonly album_artist: string; readonly album_id: string; readonly title: string; readonly year: number | null }
interface CountRow { readonly count: number }

export class PostgresArtworkLookupRepository implements ArtworkLookupRepository {
  public constructor(private readonly sql: Sql) {}

  public async listMissingAlbums(limit: number, retry: boolean): Promise<readonly MissingArtworkAlbum[]> {
    const rows = await this.sql<AlbumRow[]>`
      SELECT album.id AS album_id, album.title, album.year, COALESCE(album_credit.name, '') AS album_artist
      FROM albums AS album
      JOIN tracks AS track ON track.album_id = album.id AND track.available = true
      LEFT JOIN track_artwork AS artwork ON artwork.track_id = track.id
      LEFT JOIN artwork_lookup_attempts AS attempt ON attempt.album_id = album.id
      LEFT JOIN LATERAL (
        SELECT string_agg(artist.name, ' & ' ORDER BY album_artist.position) AS name
        FROM album_artists AS album_artist
        JOIN artists AS artist ON artist.id = album_artist.artist_id
        WHERE album_artist.album_id = album.id
      ) AS album_credit ON true
      WHERE artwork.track_id IS NULL AND (${retry} OR attempt.album_id IS NULL)
      GROUP BY album.id, album.title, album.year, album_credit.name
      ORDER BY album.updated_at, album.id
      LIMIT ${limit}
    `;
    return rows.map((row) => ({ albumArtist: row.album_artist, albumId: row.album_id, title: row.title, year: row.year }));
  }

  public async recordAttempt(albumId: string, status: ArtworkLookupAttemptStatus, match?: MusicBrainzMatch, detail?: string): Promise<void> {
    await this.sql`
      INSERT INTO artwork_lookup_attempts (album_id, status, musicbrainz_release_group_id, match_score, detail)
      VALUES (${albumId}, ${status}, ${match?.id ?? null}, ${match?.score ?? null}, ${detail ?? null})
      ON CONFLICT (album_id) DO UPDATE SET status = EXCLUDED.status,
        musicbrainz_release_group_id = EXCLUDED.musicbrainz_release_group_id,
        match_score = EXCLUDED.match_score, detail = EXCLUDED.detail, attempted_at = now()
    `;
  }

  public async saveAlbumArtwork(albumId: string, artwork: DownloadedArtwork, match: MusicBrainzMatch): Promise<number> {
    const rows = await this.sql<CountRow[]>`
      WITH inserted AS (
        INSERT INTO track_artwork (track_id, mime_type, data, source, musicbrainz_release_group_id, match_score, provenance)
        SELECT track.id, ${artwork.mimeType}, ${artwork.data}, 'musicbrainz', ${match.id}, ${match.score},
          ${this.sql.json({ artist: match.artist, title: match.title, year: match.year })}
        FROM tracks AS track
        LEFT JOIN track_artwork AS existing ON existing.track_id = track.id
        WHERE track.album_id = ${albumId} AND track.available = true AND existing.track_id IS NULL
        ON CONFLICT (track_id) DO NOTHING
        RETURNING track_id
      ) SELECT count(*)::int AS count FROM inserted
    `;
    return rows[0]?.count ?? 0;
  }
}
