import type { Sql } from 'postgres';

import type { TrackFileRepository } from '../../application/streaming-ports.js';
import type { AvailableTrackFile } from '../../domain/streaming.js';

interface TrackFileRow {
  readonly library_root_path: string;
  readonly relative_path: string;
}

export class PostgresTrackFileRepository implements TrackFileRepository {
  public constructor(private readonly sql: Sql) {}

  public async findAvailableById(trackId: string): Promise<AvailableTrackFile | null> {
    const [row] = await this.sql<TrackFileRow[]>`
      SELECT library_roots.path AS library_root_path, tracks.relative_path
      FROM tracks
      INNER JOIN library_roots ON library_roots.id = tracks.library_root_id
      WHERE tracks.id = ${trackId}::uuid
        AND tracks.available = true
        AND library_roots.enabled = true
    `;
    return row === undefined
      ? null
      : { libraryRootPath: row.library_root_path, relativePath: row.relative_path };
  }
}
