import type { Sql } from 'postgres';

import type { BrainGraph, BrainGraphEdge, BrainGraphNode, BrainGraphOperations } from '../../application/brain-graph.js';

interface NodeRow { id: string; label: string; type: BrainGraphNode['type'] }
interface EdgeRow { id: string; source: string; target: string; type: BrainGraphEdge['type'] }

export class PostgresBrainGraph implements BrainGraphOperations {
  public constructor(private readonly sql: Sql) {}

  public async get(): Promise<BrainGraph> {
    const nodes = await this.sql<NodeRow[]>`
      SELECT 'track:' || id AS id, title AS label, 'track' AS type FROM tracks WHERE available = true
      UNION ALL SELECT 'artist:' || id, name, 'artist' FROM artists
      UNION ALL SELECT 'album:' || id, title, 'album' FROM albums
      UNION ALL SELECT 'genre:' || id, name, 'genre' FROM genres
      ORDER BY type, label, id
    `;
    const edges = await this.sql<EdgeRow[]>`
      SELECT 'artist:' || ta.artist_id || ':track:' || ta.track_id AS id,
        'artist:' || ta.artist_id AS source, 'track:' || ta.track_id AS target, 'artist' AS type
      FROM track_artists ta JOIN tracks t ON t.id = ta.track_id AND t.available = true
      UNION ALL SELECT 'album:' || t.album_id || ':track:' || t.id,
        'album:' || t.album_id, 'track:' || t.id, 'album'
      FROM tracks t WHERE t.available = true AND t.album_id IS NOT NULL
      UNION ALL SELECT 'genre:' || tg.genre_id || ':track:' || tg.track_id,
        'genre:' || tg.genre_id, 'track:' || tg.track_id, 'genre'
      FROM track_genres tg JOIN tracks t ON t.id = tg.track_id AND t.available = true
      ORDER BY type, source, target
    `;
    return { edges, nodes };
  }
}
