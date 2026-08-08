export interface User {
  readonly id: string;
  readonly email: string;
  readonly role?: string;
}

export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: User;
}

export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artists: readonly string[];
  readonly album: string | null;
  readonly durationSeconds: number | null;
  readonly year: number | null;
  readonly hasArtwork: boolean;
}

export interface TrackPage {
  readonly tracks: readonly Track[];
  readonly total: number;
}

export interface BrainSyncResult {
  readonly counts: {
    readonly albums: number;
    readonly artists: number;
    readonly genres: number;
    readonly tracks: number;
  };
  readonly errors: readonly { readonly message: string }[];
}

export interface ScanResult {
  readonly status: string;
  readonly processed: number;
  readonly discovered: number;
  readonly failed: number;
}

export type ArtworkLookupState = 'idle' | 'running' | 'completed';

export interface ArtworkLookupProgress {
  readonly attempted: number;
  readonly coversApplied: number;
  readonly errors: readonly string[];
  readonly failed: number;
  readonly finishedAt: string | null;
  readonly matched: number;
  readonly noCover: number;
  readonly noMatch: number;
  readonly queued: number;
  readonly startedAt: string | null;
  readonly state: ArtworkLookupState;
  readonly tracksUpdated: number;
}

export type ListeningEventType = 'started' | 'progress' | 'paused' | 'completed';

export interface ListeningPosition {
  readonly trackId: string;
  readonly positionSeconds: number;
  readonly updatedAt: string;
}

export interface RecentListeningItem extends ListeningPosition {
  readonly eventType: ListeningEventType;
  readonly occurredAt: string;
}

export interface PlaylistItem {
  readonly id: string;
  readonly position: number;
  readonly trackId: string;
}

export interface Playlist {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly items: readonly PlaylistItem[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Device {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
}

export interface QueueSnapshot {
  readonly deviceId: string;
  readonly items: readonly string[];
  readonly currentIndex: number | null;
  readonly positionSeconds: number;
  readonly updatedAt: string;
}

export type BrainNodeType = 'track' | 'artist' | 'album' | 'genre' | 'playlist' | 'favorites';
export type BrainEdgeType = 'artist' | 'album' | 'genre' | 'playlist' | 'favorite';
export type BrainNodeProperty = boolean | number | string | null;
export interface BrainGraphNode { readonly id: string; readonly label: string; readonly type: BrainNodeType; readonly properties: Readonly<Record<string, BrainNodeProperty>> }
export interface BrainGraphEdge { readonly id: string; readonly source: string; readonly target: string; readonly type: BrainEdgeType }
export interface BrainGraph { readonly nodes: readonly BrainGraphNode[]; readonly edges: readonly BrainGraphEdge[] }
