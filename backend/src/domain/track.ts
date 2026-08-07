export interface FileIdentity {
  readonly libraryRootId: string;
  readonly modifiedAt: Date;
  readonly relativePath: string;
  readonly size: number;
}

export interface NumberPair {
  readonly number: number | null;
  readonly total: number | null;
}

export interface TrackMetadata {
  readonly album: string | null;
  readonly albumArtists: readonly string[];
  readonly artists: readonly string[];
  readonly bitrate: number | null;
  readonly codec: string | null;
  readonly container: string | null;
  readonly disc: NumberPair;
  readonly durationSeconds: number | null;
  readonly genres: readonly string[];
  readonly sampleRate: number | null;
  readonly title: string;
  readonly track: NumberPair;
  readonly year: number | null;
}

export interface ScannedTrack extends FileIdentity {
  readonly metadata: TrackMetadata;
}
