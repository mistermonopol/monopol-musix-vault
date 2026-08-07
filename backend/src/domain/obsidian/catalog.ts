export interface ObsidianNamedEntity {
  readonly id: string;
  readonly name: string;
}

export interface ObsidianAlbum {
  readonly id: string;
  readonly title: string;
}

export interface ObsidianCatalogTrack {
  readonly album: ObsidianAlbum | null;
  readonly artists: readonly ObsidianNamedEntity[];
  readonly codec: string | null;
  readonly durationSeconds: number | null;
  readonly genres: readonly ObsidianNamedEntity[];
  readonly id: string;
  readonly title: string;
  readonly year: number | null;
}

export interface ObsidianSyncError {
  readonly message: string;
  readonly noteId?: string;
  readonly noteType?: 'track' | 'artist' | 'album' | 'genre';
}

export interface ObsidianSyncCounts {
  readonly albums: number;
  readonly artists: number;
  readonly genres: number;
  readonly tracks: number;
}

export interface ObsidianSyncResult {
  readonly counts: ObsidianSyncCounts;
  readonly errors: readonly ObsidianSyncError[];
}
