export interface ListeningEventInput {
  readonly eventType: 'started' | 'progress' | 'paused' | 'completed';
  readonly occurredAt?: Date | undefined;
  readonly positionSeconds?: number | undefined;
  readonly trackId: string;
}

export interface ListeningPosition {
  readonly positionSeconds: number;
  readonly trackId: string;
  readonly updatedAt: Date;
}

export interface RecentListeningItem extends ListeningPosition {
  readonly eventType: ListeningEventInput['eventType'];
  readonly occurredAt: Date;
}

export interface ListeningOperations {
  addEvent(userId: string, input: ListeningEventInput): Promise<{ readonly id: string }>;
  getPosition(userId: string, trackId: string): Promise<ListeningPosition | null>;
  listRecent(userId: string, limit: number): Promise<readonly RecentListeningItem[]>;
  upsertPosition(userId: string, trackId: string, positionSeconds: number): Promise<ListeningPosition | null>;
}

export interface PlaylistItem { readonly id: string; readonly position: number; readonly trackId: string }
export interface Playlist {
  readonly createdAt: Date;
  readonly description: string;
  readonly id: string;
  readonly items: readonly PlaylistItem[];
  readonly name: string;
  readonly updatedAt: Date;
}
export interface PlaylistOperations {
  create(userId: string, name: string, description: string): Promise<Playlist>;
  delete(userId: string, playlistId: string): Promise<boolean>;
  get(userId: string, playlistId: string): Promise<Playlist | null>;
  list(userId: string): Promise<readonly Playlist[]>;
  replaceItems(userId: string, playlistId: string, trackIds: readonly string[]): Promise<Playlist | null>;
  update(userId: string, playlistId: string, name: string, description: string): Promise<Playlist | null>;
}

export interface Device {
  readonly createdAt: Date;
  readonly id: string;
  readonly kind: string;
  readonly lastSeenAt: Date;
  readonly name: string;
}
export interface DeviceOperations {
  list(userId: string): Promise<readonly Device[]>;
  register(userId: string, name: string, kind: string): Promise<Device>;
  revoke(userId: string, deviceId: string): Promise<boolean>;
}

export interface QueueSnapshot {
  readonly currentIndex: number | null;
  readonly deviceId: string;
  readonly items: readonly string[];
  readonly positionSeconds: number;
  readonly updatedAt: Date;
}
export interface QueueOperations {
  get(userId: string, deviceId: string): Promise<QueueSnapshot | null>;
  save(userId: string, snapshot: Omit<QueueSnapshot, 'updatedAt'>): Promise<QueueSnapshot | null>;
  transfer(userId: string, sourceDeviceId: string, targetDeviceId: string): Promise<QueueSnapshot | null>;
}
