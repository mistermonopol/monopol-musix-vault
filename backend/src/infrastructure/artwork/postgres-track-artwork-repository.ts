import type { Sql } from 'postgres';

import type { TrackArtwork, TrackArtworkRepository } from '../../application/track-artwork.js';

interface ArtworkRow {
  readonly data: Buffer;
  readonly mime_type: TrackArtwork['mimeType'];
}

export class PostgresTrackArtworkRepository implements TrackArtworkRepository {
  public constructor(private readonly sql: Sql) {}

  public async findAvailableByTrackId(trackId: string): Promise<TrackArtwork | null> {
    const [row] = await this.sql<ArtworkRow[]>`
      SELECT artwork.mime_type, artwork.data
      FROM track_artwork AS artwork
      JOIN tracks AS track ON track.id = artwork.track_id
      JOIN library_roots AS root ON root.id = track.library_root_id
      WHERE artwork.track_id = ${trackId}::uuid
        AND track.available = true
        AND root.enabled = true
    `;
    return row === undefined ? null : { data: row.data, mimeType: row.mime_type };
  }
}
