export interface TrackArtwork {
  readonly data: Buffer;
  readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface TrackArtworkRepository {
  findAvailableByTrackId(trackId: string): Promise<TrackArtwork | null>;
}

export interface TrackArtworkOperations {
  get(trackId: string): Promise<TrackArtwork | null>;
}

export class TrackArtworkService implements TrackArtworkOperations {
  public constructor(private readonly repository: TrackArtworkRepository) {}

  public get(trackId: string): Promise<TrackArtwork | null> {
    return this.repository.findAvailableByTrackId(trackId);
  }
}
