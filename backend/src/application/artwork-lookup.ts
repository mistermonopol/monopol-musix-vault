export type ArtworkLookupJobState = 'idle' | 'running' | 'completed';
export type ArtworkLookupAttemptStatus = 'success' | 'no_match' | 'no_cover' | 'failed';

export interface MissingArtworkAlbum {
  readonly albumArtist: string;
  readonly albumId: string;
  readonly title: string;
  readonly year: number | null;
}

export interface MusicBrainzMatch {
  readonly artist: string;
  readonly id: string;
  readonly score: number;
  readonly title: string;
  readonly year: number | null;
}

export interface DownloadedArtwork {
  readonly data: Buffer;
  readonly mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface ArtworkLookupRepository {
  listMissingAlbums(limit: number, retry: boolean): Promise<readonly MissingArtworkAlbum[]>;
  recordAttempt(albumId: string, status: ArtworkLookupAttemptStatus, match?: MusicBrainzMatch, detail?: string): Promise<void>;
  saveAlbumArtwork(albumId: string, artwork: DownloadedArtwork, match: MusicBrainzMatch): Promise<number>;
}

export interface MusicBrainzArtworkProvider {
  findReleaseGroup(album: MissingArtworkAlbum): Promise<MusicBrainzMatch | null>;
  fetchFrontCover(releaseGroupId: string): Promise<DownloadedArtwork | null>;
}

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
  readonly state: ArtworkLookupJobState;
  readonly tracksUpdated: number;
}

export interface StartArtworkLookupOptions { readonly retry: boolean }
export interface ArtworkLookupOperations {
  start(options: StartArtworkLookupOptions): ArtworkLookupProgress;
  status(): ArtworkLookupProgress;
}

export class ArtworkLookupDisabledError extends Error {}
export class ArtworkLookupInProgressError extends Error {}

export class ArtworkLookupService implements ArtworkLookupOperations {
  private progress: ArtworkLookupProgress = emptyProgress();

  public constructor(
    private readonly repository: ArtworkLookupRepository,
    private readonly provider: MusicBrainzArtworkProvider,
    private readonly enabled: boolean,
    private readonly batchSize: number,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public start(options: StartArtworkLookupOptions): ArtworkLookupProgress {
    if (!this.enabled) throw new ArtworkLookupDisabledError('Artwork lookup is disabled');
    if (this.progress.state === 'running') throw new ArtworkLookupInProgressError('Artwork lookup is already running');
    this.progress = { ...emptyProgress(), startedAt: this.now().toISOString(), state: 'running' };
    void this.run(options.retry);
    return this.progress;
  }

  public status(): ArtworkLookupProgress { return this.progress; }

  private async run(retry: boolean): Promise<void> {
    try {
      const albums = await this.repository.listMissingAlbums(this.batchSize, retry);
      this.patch({ queued: albums.length });
      for (const album of albums) await this.process(album);
    } catch {
      this.patch({ errors: [...this.progress.errors, 'Lookup job could not access the catalog'], failed: this.progress.failed + 1 });
    } finally {
      this.patch({ finishedAt: this.now().toISOString(), state: 'completed' });
    }
  }

  private async process(album: MissingArtworkAlbum): Promise<void> {
    this.patch({ attempted: this.progress.attempted + 1 });
    try {
      const match = await this.provider.findReleaseGroup(album);
      if (match === null || !isConservativeMatch(album, match)) {
        await this.repository.recordAttempt(album.albumId, 'no_match', match ?? undefined);
        this.patch({ noMatch: this.progress.noMatch + 1 });
        return;
      }
      this.patch({ matched: this.progress.matched + 1 });
      const artwork = await this.provider.fetchFrontCover(match.id);
      if (artwork === null) {
        await this.repository.recordAttempt(album.albumId, 'no_cover', match);
        this.patch({ noCover: this.progress.noCover + 1 });
        return;
      }
      const tracksUpdated = await this.repository.saveAlbumArtwork(album.albumId, artwork, match);
      await this.repository.recordAttempt(album.albumId, 'success', match);
      this.patch({ coversApplied: this.progress.coversApplied + 1, tracksUpdated: this.progress.tracksUpdated + tracksUpdated });
    } catch {
      try { await this.repository.recordAttempt(album.albumId, 'failed', undefined, 'External artwork lookup failed'); } catch { /* per-item failure */ }
      this.patch({ errors: [...this.progress.errors, `Lookup failed for album ${this.progress.attempted}`], failed: this.progress.failed + 1 });
    }
  }

  private patch(value: Partial<ArtworkLookupProgress>): void { this.progress = { ...this.progress, ...value }; }
}

export function normalizeMusicText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function isConservativeMatch(album: MissingArtworkAlbum, match: MusicBrainzMatch): boolean {
  if (match.score < 90) return false;
  if (normalizeMusicText(album.title) !== normalizeMusicText(match.title)) return false;
  if (album.albumArtist && normalizeMusicText(album.albumArtist) !== normalizeMusicText(match.artist)) return false;
  return album.year === null || match.year === null || album.year === match.year;
}

function emptyProgress(): ArtworkLookupProgress {
  return { attempted: 0, coversApplied: 0, errors: [], failed: 0, finishedAt: null, matched: 0, noCover: 0, noMatch: 0, queued: 0, startedAt: null, state: 'idle', tracksUpdated: 0 };
}
