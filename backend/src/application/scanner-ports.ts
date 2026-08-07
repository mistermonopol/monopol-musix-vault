import type { FileIdentity, ScannedTrack, TrackMetadata } from '../domain/track.js';
import type { LibraryRoot, ScanCounts, ScanStatus } from '../domain/music.js';

export interface DiscoveredAudioFile extends FileIdentity {
  readonly absolutePath: string;
}

export interface AudioFileDiscovery {
  discover(root: LibraryRoot): AsyncIterable<DiscoveredAudioFile>;
}

export interface AudioMetadataReader {
  read(absolutePath: string): Promise<TrackMetadata>;
}

export interface ScanSession {
  readonly id: string;
  readonly startedAt: Date;
}

export interface MusicScanRepository {
  beginScan(): Promise<ScanSession | null>;
  completeScan(scanId: string, status: ScanStatus, counts: ScanCounts): Promise<void>;
  findUnchanged(file: FileIdentity): Promise<boolean>;
  listLibraryRoots(): Promise<readonly LibraryRoot[]>;
  markMissing(scanId: string, rootIds: readonly string[]): Promise<number>;
  markSeen(scanId: string, file: FileIdentity): Promise<void>;
  saveTrack(scanId: string, track: ScannedTrack): Promise<void>;
}
