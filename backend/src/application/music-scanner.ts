import type { ScanCounts, ScanFileError, ScanProgress, ScanResult } from '../domain/music.js';
import type { AudioFileDiscovery, AudioMetadataReader, MusicScanRepository } from './scanner-ports.js';

export class ScanAlreadyRunningError extends Error {
  public constructor() {
    super('A music scan is already running');
    this.name = 'ScanAlreadyRunningError';
  }
}

export type ScanProgressHandler = (progress: ScanProgress) => void;

export interface MusicScannerOperations {
  scan(onProgress?: ScanProgressHandler): Promise<ScanResult>;
}

interface MutableCounts {
  discovered: number;
  failed: number;
  missing: number;
  processed: number;
  unchanged: number;
}

export class MusicScanner implements MusicScannerOperations {
  public constructor(
    private readonly repository: MusicScanRepository,
    private readonly discovery: AudioFileDiscovery,
    private readonly metadataReader: AudioMetadataReader,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async scan(onProgress?: ScanProgressHandler): Promise<ScanResult> {
    const session = await this.repository.beginScan();
    if (session === null) throw new ScanAlreadyRunningError();

    const counts: MutableCounts = { discovered: 0, failed: 0, missing: 0, processed: 0, unchanged: 0 };
    const errors: ScanFileError[] = [];
    let status: ScanResult['status'] = 'completed';

    try {
      const roots = await this.repository.listLibraryRoots();
      const successfullyDiscoveredRootIds: string[] = [];
      for (const root of roots) {
        this.report(onProgress, session.id, counts, 'discovering', root.path);
        try {
          for await (const file of this.discovery.discover(root)) {
            counts.discovered += 1;
            this.report(onProgress, session.id, counts, 'processing', file.absolutePath);
            try {
              if (await this.repository.findUnchanged(file)) {
                await this.repository.markSeen(session.id, file);
                counts.unchanged += 1;
              } else {
                const metadata = await this.metadataReader.read(file.absolutePath);
                await this.repository.saveTrack(session.id, { ...file, metadata });
                counts.processed += 1;
              }
            } catch (error: unknown) {
              counts.failed += 1;
              errors.push({ message: errorMessage(error), path: file.absolutePath });
            }
          }
          successfullyDiscoveredRootIds.push(root.id);
        } catch (error: unknown) {
          counts.failed += 1;
          errors.push({ message: errorMessage(error), path: root.path });
        }
      }
      this.report(onProgress, session.id, counts, 'reconciling', null);
      counts.missing = await this.repository.markMissing(session.id, successfullyDiscoveredRootIds);
    } catch (error: unknown) {
      status = 'failed';
      errors.push({ message: errorMessage(error), path: '' });
    }

    const immutableCounts: ScanCounts = { ...counts };
    try {
      await this.repository.completeScan(session.id, status, immutableCounts);
    } catch (error: unknown) {
      status = 'failed';
      errors.push({ message: errorMessage(error), path: '' });
    }
    const result: ScanResult = {
      ...counts,
      errors,
      finishedAt: this.now(),
      scanId: session.id,
      startedAt: session.startedAt,
      status,
    };
    this.report(onProgress, session.id, counts, 'complete', null);
    return result;
  }

  private report(
    handler: ScanProgressHandler | undefined,
    scanId: string,
    counts: ScanCounts,
    phase: ScanProgress['phase'],
    currentPath: string | null,
  ): void {
    handler?.({ ...counts, currentPath, phase, scanId });
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
