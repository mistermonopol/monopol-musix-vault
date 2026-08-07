import type { Sql } from 'postgres';

import type { MusicScanRepository, ScanSession } from '../../application/scanner-ports.js';
import type { LibraryRoot, ScanCounts, ScanStatus } from '../../domain/music.js';
import type { FileIdentity, ScannedTrack } from '../../domain/track.js';

interface IdRow { readonly id: string }
interface RootRow { readonly id: string; readonly path: string }

export class PostgresMusicScanRepository implements MusicScanRepository {
  public constructor(private readonly sql: Sql) {}

  public async beginScan(): Promise<ScanSession | null> {
    try {
      const [row] = await this.sql<{ id: string; started_at: Date }[]>`
        INSERT INTO scan_runs DEFAULT VALUES RETURNING id, started_at
      `;
      return row === undefined ? null : { id: row.id, startedAt: row.started_at };
    } catch (error: unknown) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  public async completeScan(scanId: string, status: ScanStatus, counts: ScanCounts): Promise<void> {
    await this.sql`
      UPDATE scan_runs SET
        status = ${status}, finished_at = now(), discovered_count = ${counts.discovered},
        processed_count = ${counts.processed}, unchanged_count = ${counts.unchanged},
        failed_count = ${counts.failed}, missing_count = ${counts.missing}
      WHERE id = ${scanId} AND status = 'running'
    `;
  }

  public async findUnchanged(file: FileIdentity): Promise<boolean> {
    const [row] = await this.sql<{ unchanged: boolean }[]>`
      SELECT (file_size = ${file.size} AND modified_at = ${file.modifiedAt}) AS unchanged
      FROM tracks
      WHERE library_root_id = ${file.libraryRootId} AND relative_path = ${file.relativePath}
    `;
    return row?.unchanged ?? false;
  }

  public async listLibraryRoots(): Promise<readonly LibraryRoot[]> {
    const rows = await this.sql<RootRow[]>`
      SELECT id, path FROM library_roots WHERE enabled = true ORDER BY path
    `;
    return rows;
  }

  public async markSeen(scanId: string, file: FileIdentity): Promise<void> {
    await this.sql`
      UPDATE tracks SET available = true, last_seen_scan_id = ${scanId}, scanned_at = now()
      WHERE library_root_id = ${file.libraryRootId} AND relative_path = ${file.relativePath}
    `;
  }

  public async markMissing(scanId: string, rootIds: readonly string[]): Promise<number> {
    if (rootIds.length === 0) return 0;
    const rows = await this.sql<IdRow[]>`
      UPDATE tracks SET available = false, updated_at = now()
      WHERE library_root_id = ANY(${rootIds}::uuid[])
        AND available = true
        AND last_seen_scan_id IS DISTINCT FROM ${scanId}
      RETURNING id
    `;
    return rows.length;
  }

  public saveTrack(scanId: string, track: ScannedTrack): Promise<void> {
    return this.sql.begin(async (transaction) => {
      const metadata = track.metadata;
      const albumArtistKey = metadata.albumArtists.map(normalize).sort().join('\u0000');
      let albumId: string | null = null;
      if (metadata.album !== null) {
        const [album] = await transaction<IdRow[]>`
          INSERT INTO albums (title, normalized_title, album_artist_key, year)
          VALUES (${metadata.album}, ${normalize(metadata.album)}, ${albumArtistKey}, ${metadata.year})
          ON CONFLICT (normalized_title, album_artist_key) DO UPDATE
          SET title = EXCLUDED.title, year = COALESCE(EXCLUDED.year, albums.year), updated_at = now()
          RETURNING id
        `;
        albumId = album?.id ?? null;
        if (albumId !== null) {
          await transaction`DELETE FROM album_artists WHERE album_id = ${albumId}`;
          for (const [position, name] of metadata.albumArtists.entries()) {
            const [artist] = await transaction<IdRow[]>`
              INSERT INTO artists (name, normalized_name) VALUES (${name}, ${normalize(name)})
              ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name RETURNING id
            `;
            if (artist !== undefined) {
              await transaction`
                INSERT INTO album_artists (album_id, artist_id, position)
                VALUES (${albumId}, ${artist.id}, ${position})
              `;
            }
          }
        }
      }

      const [saved] = await transaction<IdRow[]>`
        INSERT INTO tracks (
          library_root_id, relative_path, file_size, modified_at, title, album_id, year,
          track_number, track_total, disc_number, disc_total, duration_seconds, codec,
          container, bitrate, sample_rate, available, last_seen_scan_id
        ) VALUES (
          ${track.libraryRootId}, ${track.relativePath}, ${track.size}, ${track.modifiedAt},
          ${metadata.title}, ${albumId}, ${metadata.year}, ${metadata.track.number},
          ${metadata.track.total}, ${metadata.disc.number}, ${metadata.disc.total},
          ${metadata.durationSeconds}, ${metadata.codec}, ${metadata.container},
          ${metadata.bitrate}, ${metadata.sampleRate}, true, ${scanId}
        )
        ON CONFLICT (library_root_id, relative_path) DO UPDATE SET
          file_size = EXCLUDED.file_size, modified_at = EXCLUDED.modified_at,
          title = EXCLUDED.title, album_id = EXCLUDED.album_id, year = EXCLUDED.year,
          track_number = EXCLUDED.track_number, track_total = EXCLUDED.track_total,
          disc_number = EXCLUDED.disc_number, disc_total = EXCLUDED.disc_total,
          duration_seconds = EXCLUDED.duration_seconds, codec = EXCLUDED.codec,
          container = EXCLUDED.container, bitrate = EXCLUDED.bitrate,
          sample_rate = EXCLUDED.sample_rate, available = true,
          last_seen_scan_id = EXCLUDED.last_seen_scan_id, scanned_at = now(), updated_at = now()
        RETURNING id
      `;
      if (saved === undefined) throw new Error(`Failed to save track: ${track.relativePath}`);

      await transaction`DELETE FROM track_artists WHERE track_id = ${saved.id}`;
      for (const [position, name] of metadata.artists.entries()) {
        const [artist] = await transaction<IdRow[]>`
          INSERT INTO artists (name, normalized_name) VALUES (${name}, ${normalize(name)})
          ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name RETURNING id
        `;
        if (artist !== undefined) {
          await transaction`
            INSERT INTO track_artists (track_id, artist_id, position)
            VALUES (${saved.id}, ${artist.id}, ${position})
          `;
        }
      }

      await transaction`DELETE FROM track_genres WHERE track_id = ${saved.id}`;
      for (const name of metadata.genres) {
        const [genre] = await transaction<IdRow[]>`
          INSERT INTO genres (name, normalized_name) VALUES (${name}, ${normalize(name)})
          ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name RETURNING id
        `;
        if (genre !== undefined) {
          await transaction`
            INSERT INTO track_genres (track_id, genre_id) VALUES (${saved.id}, ${genre.id})
          `;
        }
      }
    });
  }
}

function normalize(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase();
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
