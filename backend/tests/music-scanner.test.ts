import { describe, expect, it } from 'vitest';

import { MusicScanner, ScanAlreadyRunningError } from '../src/application/music-scanner.js';
import type {
  AudioFileDiscovery,
  AudioMetadataReader,
  DiscoveredAudioFile,
  MusicScanRepository,
  ScanSession,
} from '../src/application/scanner-ports.js';
import type { LibraryRoot, ScanCounts, ScanStatus } from '../src/domain/music.js';
import type { FileIdentity, ScannedTrack, TrackMetadata } from '../src/domain/track.js';
import { isSupportedAudioPath } from '../src/infrastructure/scanner/filesystem-audio-discovery.js';

const root: LibraryRoot = { id: 'root-1', path: '/music' };
const metadata: TrackMetadata = {
  album: 'Album', albumArtists: ['Album Artist'], artists: ['Artist'], artwork: null, bitrate: 320000,
  codec: 'MPEG 1 Layer 3', container: 'MPEG', disc: { number: 1, total: 1 },
  durationSeconds: 180, genres: ['Rock'], sampleRate: 44100, title: 'Song',
  track: { number: 2, total: 10 }, year: 2026,
};

function file(relativePath: string, size = 100): DiscoveredAudioFile {
  return {
    absolutePath: `/music/${relativePath}`,
    libraryRootId: root.id,
    modifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    relativePath,
    size,
  };
}

class MemoryRepository implements MusicScanRepository {
  public available = true;
  public beginResult: ScanSession | null = {
    id: 'scan-1', startedAt: new Date('2026-02-01T00:00:00.000Z'),
  };
  public completed: { counts: ScanCounts; status: ScanStatus } | null = null;
  public readonly saved: ScannedTrack[] = [];
  public readonly seen: FileIdentity[] = [];
  public unchangedPaths = new Set<string>();

  public async beginScan(): Promise<ScanSession | null> { return this.beginResult; }
  public async completeScan(_id: string, status: ScanStatus, counts: ScanCounts): Promise<void> {
    this.completed = { counts, status };
  }
  public async findUnchanged(candidate: FileIdentity): Promise<boolean> {
    return this.unchangedPaths.has(candidate.relativePath);
  }
  public async listLibraryRoots(): Promise<readonly LibraryRoot[]> { return [root]; }
  public async markMissing(): Promise<number> { this.available = false; return 2; }
  public async markSeen(_scanId: string, candidate: FileIdentity): Promise<void> { this.seen.push(candidate); }
  public async saveTrack(_scanId: string, track: ScannedTrack): Promise<void> { this.saved.push(track); }
}

function discovery(files: readonly DiscoveredAudioFile[]): AudioFileDiscovery {
  return {
    async *discover(): AsyncIterable<DiscoveredAudioFile> {
      for (const candidate of files) yield candidate;
    },
  };
}

describe('MusicScanner', () => {
  it('extracts new files, skips unchanged files, and marks missing records', async () => {
    const repository = new MemoryRepository();
    repository.unchangedPaths.add('old.mp3');
    const reader: AudioMetadataReader = { read: async () => metadata };
    const phases: string[] = [];
    const scanner = new MusicScanner(
      repository,
      discovery([file('new.flac'), file('old.mp3')]),
      reader,
      () => new Date('2026-02-01T00:01:00.000Z'),
    );

    const result = await scanner.scan((progress) => phases.push(progress.phase));

    expect(result).toMatchObject({
      discovered: 2, failed: 0, missing: 2, processed: 1, status: 'completed', unchanged: 1,
    });
    expect(repository.saved).toHaveLength(1);
    expect(repository.seen).toHaveLength(1);
    expect(repository.available).toBe(false);
    expect(repository.completed?.status).toBe('completed');
    expect(phases).toContain('reconciling');
    expect(phases.at(-1)).toBe('complete');
  });

  it('records metadata errors per file and continues scanning', async () => {
    const repository = new MemoryRepository();
    const reader: AudioMetadataReader = {
      read: async (path) => {
        if (path.endsWith('broken.mp3')) throw new Error('invalid audio');
        return metadata;
      },
    };
    const scanner = new MusicScanner(
      repository,
      discovery([file('broken.mp3'), file('valid.mp3')]),
      reader,
    );

    const result = await scanner.scan();

    expect(result).toMatchObject({ discovered: 2, failed: 1, processed: 1, status: 'completed' });
    expect(result.errors).toEqual([{ message: 'invalid audio', path: '/music/broken.mp3' }]);
    expect(repository.saved[0]?.relativePath).toBe('valid.mp3');
  });

  it('rejects a scan when the repository lock is held', async () => {
    const repository = new MemoryRepository();
    repository.beginResult = null;
    const scanner = new MusicScanner(repository, discovery([]), { read: async () => metadata });

    await expect(scanner.scan()).rejects.toBeInstanceOf(ScanAlreadyRunningError);
  });
});

describe('supported audio files', () => {
  it('matches supported extensions case-insensitively and rejects unrelated files', () => {
    expect(isSupportedAudioPath('track.FLAC')).toBe(true);
    expect(isSupportedAudioPath('track.opus')).toBe(true);
    expect(isSupportedAudioPath('cover.jpg')).toBe(false);
    expect(isSupportedAudioPath('song.mp3.tmp')).toBe(false);
  });
});
