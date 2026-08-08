import type { Sql } from 'postgres';
import type { Device, DeviceOperations, ListeningEventInput, ListeningOperations, ListeningPosition, Playlist, PlaylistItem, PlaylistOperations, QueueOperations, QueueSnapshot, RecentListeningItem } from '../../application/user-data.js';

interface PositionRow { position_seconds: number; track_id: string; updated_at: Date }
interface PlaylistRow { created_at: Date; description: string; id: string; name: string; updated_at: Date }
interface ItemRow { id: string; position: number; track_id: string }
interface DeviceRow { created_at: Date; id: string; kind: string; last_seen_at: Date; name: string }
interface QueueRow { current_index: number | null; device_id: string; items: string[]; position_seconds: number; updated_at: Date }

export class PostgresListening implements ListeningOperations {
  public constructor(private readonly sql: Sql) {}
  public async addEvent(userId: string, input: ListeningEventInput): Promise<{ readonly id: string }> {
    const rows = await this.sql<{ id: string }[]>`INSERT INTO listening_events (user_id, track_id, event_type, position_seconds, occurred_at) SELECT ${userId}, id, ${input.eventType}, ${input.positionSeconds ?? null}, ${input.occurredAt ?? new Date()} FROM tracks WHERE id = ${input.trackId} AND available = true RETURNING id`;
    if (rows[0] === undefined) throw new Error('TRACK_NOT_FOUND');
    return rows[0];
  }
  public async getPosition(userId: string, trackId: string): Promise<ListeningPosition | null> {
    const rows = await this.sql<PositionRow[]>`SELECT p.track_id, p.position_seconds, p.updated_at FROM listening_positions p JOIN tracks t ON t.id = p.track_id AND t.available = true WHERE p.user_id = ${userId} AND p.track_id = ${trackId}`;
    return rows[0] === undefined ? null : position(rows[0]);
  }
  public async listRecent(userId: string, limit: number): Promise<readonly RecentListeningItem[]> {
    const rows = await this.sql<(PositionRow & { event_type: ListeningEventInput['eventType']; occurred_at: Date })[]>`WITH recent AS (SELECT DISTINCT ON (e.track_id) e.track_id, e.event_type, e.occurred_at, COALESCE(p.position_seconds, e.position_seconds, 0) AS position_seconds, COALESCE(p.updated_at, e.occurred_at) AS updated_at FROM listening_events e JOIN tracks t ON t.id = e.track_id AND t.available = true LEFT JOIN listening_positions p ON p.user_id = e.user_id AND p.track_id = e.track_id WHERE e.user_id = ${userId} ORDER BY e.track_id, e.occurred_at DESC) SELECT track_id, event_type, occurred_at, position_seconds, updated_at FROM recent ORDER BY occurred_at DESC LIMIT ${limit}`;
    return rows.map((row) => ({ ...position(row), eventType: row.event_type, occurredAt: row.occurred_at }));
  }
  public async upsertPosition(userId: string, trackId: string, seconds: number): Promise<ListeningPosition | null> {
    const rows = await this.sql<PositionRow[]>`INSERT INTO listening_positions (user_id, track_id, position_seconds) SELECT ${userId}, id, ${seconds} FROM tracks WHERE id = ${trackId} AND available = true ON CONFLICT (user_id, track_id) DO UPDATE SET position_seconds = EXCLUDED.position_seconds, updated_at = CASE WHEN listening_positions.position_seconds IS DISTINCT FROM EXCLUDED.position_seconds THEN now() ELSE listening_positions.updated_at END RETURNING track_id, position_seconds, updated_at`;
    return rows[0] === undefined ? null : position(rows[0]);
  }
}

export class PostgresPlaylists implements PlaylistOperations {
  public constructor(private readonly sql: Sql) {}
  public async create(userId: string, name: string, description: string): Promise<Playlist> { const rows = await this.sql<PlaylistRow[]>`INSERT INTO playlists (user_id, name, description) VALUES (${userId}, ${name}, ${description}) RETURNING id, name, description, created_at, updated_at`; return playlist(rows[0]!, []); }
  public async delete(userId: string, id: string): Promise<boolean> { return (await this.sql`DELETE FROM playlists WHERE id = ${id} AND user_id = ${userId} RETURNING id`).length > 0; }
  public async get(userId: string, id: string): Promise<Playlist | null> { const rows = await this.sql<PlaylistRow[]>`SELECT id, name, description, created_at, updated_at FROM playlists WHERE id = ${id} AND user_id = ${userId}`; if (rows[0] === undefined) return null; const items = await this.sql<ItemRow[]>`SELECT id, track_id, position FROM playlist_items WHERE playlist_id = ${id} ORDER BY position`; return playlist(rows[0], items); }
  public async list(userId: string): Promise<readonly Playlist[]> { const rows = await this.sql<PlaylistRow[]>`SELECT id, name, description, created_at, updated_at FROM playlists WHERE user_id = ${userId} ORDER BY updated_at DESC, id`; return Promise.all(rows.map(async (row) => (await this.get(userId, row.id))!)); }
  public async replaceItems(userId: string, id: string, trackIds: readonly string[]): Promise<Playlist | null> { if (await this.get(userId, id) === null) return null; await this.sql.begin(async (tx) => { const found = trackIds.length === 0 ? [] : await tx`SELECT id FROM tracks WHERE id IN ${tx(trackIds)} AND available = true`; if (found.length !== new Set(trackIds).size) throw new Error('TRACK_NOT_FOUND'); await tx`DELETE FROM playlist_items WHERE playlist_id = ${id}`; for (const [index, trackId] of trackIds.entries()) await tx`INSERT INTO playlist_items (playlist_id, track_id, position) VALUES (${id}, ${trackId}, ${index})`; await tx`UPDATE playlists SET updated_at = now() WHERE id = ${id}`; }); return this.get(userId, id); }
  public async update(userId: string, id: string, name: string, description: string): Promise<Playlist | null> { const rows = await this.sql`UPDATE playlists SET name = ${name}, description = ${description}, updated_at = now() WHERE id = ${id} AND user_id = ${userId} RETURNING id`; return rows.length === 0 ? null : this.get(userId, id); }
}

export class PostgresDevices implements DeviceOperations {
  public constructor(private readonly sql: Sql) {}
  public async list(userId: string): Promise<readonly Device[]> { const rows = await this.sql<DeviceRow[]>`SELECT id, name, kind, last_seen_at, created_at FROM user_devices WHERE user_id = ${userId} AND revoked_at IS NULL ORDER BY created_at DESC`; return rows.map(device); }
  public async register(userId: string, name: string, kind: string): Promise<Device> { const rows = await this.sql<DeviceRow[]>`INSERT INTO user_devices (user_id, name, kind) VALUES (${userId}, ${name}, ${kind}) RETURNING id, name, kind, last_seen_at, created_at`; return device(rows[0]!); }
  public async revoke(userId: string, id: string): Promise<boolean> { return this.sql.begin(async (tx) => { const rows = await tx`UPDATE user_devices SET revoked_at = now() WHERE id = ${id} AND user_id = ${userId} AND revoked_at IS NULL RETURNING id`; if (rows.length === 0) return false; await tx`UPDATE refresh_sessions SET revoked_at = now() WHERE device_id = ${id} AND revoked_at IS NULL`; return true; }); }
}

export class PostgresQueues implements QueueOperations {
  public constructor(private readonly sql: Sql) {}
  public async get(userId: string, deviceId: string): Promise<QueueSnapshot | null> { const rows = await this.sql<QueueRow[]>`SELECT device_id, items, current_index, position_seconds, updated_at FROM queue_snapshots WHERE user_id = ${userId} AND device_id = ${deviceId}`; return rows[0] === undefined ? null : queue(rows[0]); }
  public async save(userId: string, value: Omit<QueueSnapshot, 'updatedAt'>): Promise<QueueSnapshot | null> { if (!await owns(this.sql, userId, value.deviceId)) return null; const found = value.items.length === 0 ? [] : await this.sql`SELECT id FROM tracks WHERE id IN ${this.sql(value.items)} AND available = true`; if (found.length !== new Set(value.items).size) throw new Error('TRACK_NOT_FOUND'); const rows = await this.sql<QueueRow[]>`INSERT INTO queue_snapshots (user_id, device_id, items, current_index, position_seconds) VALUES (${userId}, ${value.deviceId}, ${this.sql.json(value.items)}, ${value.currentIndex}, ${value.positionSeconds}) ON CONFLICT (user_id, device_id) DO UPDATE SET items = EXCLUDED.items, current_index = EXCLUDED.current_index, position_seconds = EXCLUDED.position_seconds, updated_at = now() RETURNING device_id, items, current_index, position_seconds, updated_at`; return queue(rows[0]!); }
  public async transfer(userId: string, source: string, target: string): Promise<QueueSnapshot | null> { if (!await owns(this.sql, userId, target)) return null; const rows = await this.sql<QueueRow[]>`INSERT INTO queue_snapshots (user_id, device_id, items, current_index, position_seconds) SELECT user_id, ${target}, items, current_index, position_seconds FROM queue_snapshots WHERE user_id = ${userId} AND device_id = ${source} ON CONFLICT (user_id, device_id) DO UPDATE SET items = EXCLUDED.items, current_index = EXCLUDED.current_index, position_seconds = EXCLUDED.position_seconds, updated_at = now() RETURNING device_id, items, current_index, position_seconds, updated_at`; return rows[0] === undefined ? null : queue(rows[0]); }
}

function position(row: PositionRow): ListeningPosition { return { positionSeconds: row.position_seconds, trackId: row.track_id, updatedAt: row.updated_at }; }
function playlist(row: PlaylistRow, rows: readonly ItemRow[]): Playlist { const items: PlaylistItem[] = rows.map((x) => ({ id: x.id, position: x.position, trackId: x.track_id })); return { createdAt: row.created_at, description: row.description, id: row.id, items, name: row.name, updatedAt: row.updated_at }; }
function device(row: DeviceRow): Device { return { createdAt: row.created_at, id: row.id, kind: row.kind, lastSeenAt: row.last_seen_at, name: row.name }; }
function queue(row: QueueRow): QueueSnapshot { return { currentIndex: row.current_index, deviceId: row.device_id, items: row.items, positionSeconds: row.position_seconds, updatedAt: row.updated_at }; }
async function owns(sql: Sql, userId: string, id: string): Promise<boolean> { return (await sql`SELECT 1 FROM user_devices WHERE id = ${id} AND user_id = ${userId} AND revoked_at IS NULL`).length > 0; }
