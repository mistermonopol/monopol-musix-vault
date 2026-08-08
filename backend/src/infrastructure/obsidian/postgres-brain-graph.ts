import type { Sql } from 'postgres';

import type { BrainGraph, BrainGraphEdge, BrainGraphNode, BrainGraphOperations } from '../../application/brain-graph.js';

interface NodeRow { id: string; label: string; properties: BrainGraphNode['properties']; type: BrainGraphNode['type'] }
interface EdgeRow { id: string; source: string; target: string; type: BrainGraphEdge['type'] }

export class PostgresBrainGraph implements BrainGraphOperations {
  public constructor(private readonly sql: Sql) {}

  public async get(userId: string): Promise<BrainGraph> {
    const [nodes, edges] = await Promise.all([
      this.sql<NodeRow[]>`
        SELECT 'track:' || track.id AS id, track.title AS label, 'track' AS type,
          jsonb_build_object(
            'year', track.year,
            'releaseDate', CASE WHEN track.year IS NULL THEN NULL ELSE track.year::text END,
            'durationSeconds', track.duration_seconds,
            'codec', track.codec,
            'favorite', favorite.track_id IS NOT NULL,
            'hasArtwork', artwork.track_id IS NOT NULL
          ) AS properties
        FROM tracks AS track
        LEFT JOIN user_track_favorites AS favorite
          ON favorite.track_id = track.id AND favorite.user_id = ${userId}::uuid
        LEFT JOIN track_artwork AS artwork ON artwork.track_id = track.id
        WHERE track.available = true
        UNION ALL
        SELECT 'artist:' || artist.id, artist.name, 'artist', '{}'::jsonb
        FROM artists AS artist
        WHERE EXISTS (
          SELECT 1 FROM track_artists ta JOIN tracks t ON t.id = ta.track_id
          WHERE ta.artist_id = artist.id AND t.available = true
        )
        UNION ALL
        SELECT 'album:' || album.id, album.title, 'album', jsonb_build_object('year', album.year)
        FROM albums AS album
        WHERE EXISTS (SELECT 1 FROM tracks t WHERE t.album_id = album.id AND t.available = true)
        UNION ALL
        SELECT 'genre:' || genre.id, genre.name, 'genre', '{}'::jsonb
        FROM genres AS genre
        WHERE EXISTS (
          SELECT 1 FROM track_genres tg JOIN tracks t ON t.id = tg.track_id
          WHERE tg.genre_id = genre.id AND t.available = true
        )
        UNION ALL
        SELECT 'playlist:' || playlist.id, playlist.name, 'playlist',
          jsonb_build_object('description', playlist.description, 'updatedAt', playlist.updated_at)
        FROM playlists AS playlist WHERE playlist.user_id = ${userId}::uuid
        UNION ALL
        SELECT 'favorites:mine', 'Favorites', 'favorites', '{}'::jsonb
        ORDER BY type, label, id
      `,
      this.sql<EdgeRow[]>`
        SELECT 'artist:' || ta.artist_id || ':track:' || ta.track_id AS id,
          'artist:' || ta.artist_id AS source, 'track:' || ta.track_id AS target, 'artist' AS type
        FROM track_artists ta JOIN tracks t ON t.id = ta.track_id AND t.available = true
        UNION ALL SELECT 'album:' || t.album_id || ':track:' || t.id,
          'album:' || t.album_id, 'track:' || t.id, 'album'
        FROM tracks t WHERE t.available = true AND t.album_id IS NOT NULL
        UNION ALL SELECT 'genre:' || tg.genre_id || ':track:' || tg.track_id,
          'genre:' || tg.genre_id, 'track:' || tg.track_id, 'genre'
        FROM track_genres tg JOIN tracks t ON t.id = tg.track_id AND t.available = true
        UNION ALL SELECT 'playlist:' || pi.playlist_id || ':track:' || pi.track_id,
          'playlist:' || pi.playlist_id, 'track:' || pi.track_id, 'playlist'
        FROM playlist_items pi
        JOIN playlists p ON p.id = pi.playlist_id AND p.user_id = ${userId}::uuid
        JOIN tracks t ON t.id = pi.track_id AND t.available = true
        UNION ALL SELECT 'favorites:mine:track:' || f.track_id,
          'favorites:mine', 'track:' || f.track_id, 'favorite'
        FROM user_track_favorites f
        JOIN tracks t ON t.id = f.track_id AND t.available = true
        WHERE f.user_id = ${userId}::uuid
        ORDER BY type, source, target
      `,
    ]);
    return { edges, nodes };
  }
}
