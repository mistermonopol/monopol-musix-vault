import type { AudioMimeTypeResolver, TrackFileRepository, TrackFileSystem } from './streaming-ports.js';
import { parseByteRange } from '../domain/byte-range.js';
import type { OpenedTrackStream, StreamableFile } from '../domain/streaming.js';

export class TrackNotFoundError extends Error {
  public constructor() {
    super('Available track not found');
    this.name = 'TrackNotFoundError';
  }
}

export class TrackFileUnavailableError extends Error {
  public constructor() {
    super('Track path does not identify a regular file');
    this.name = 'TrackFileUnavailableError';
  }
}

export interface TrackStreamingOperations {
  open(trackId: string, rangeHeader?: string): Promise<OpenedTrackStream>;
  resolve(trackId: string): Promise<StreamableFile>;
}

export class TrackStreamingService implements TrackStreamingOperations {
  public constructor(
    private readonly repository: TrackFileRepository,
    private readonly fileSystem: TrackFileSystem,
    private readonly mimeTypes: AudioMimeTypeResolver,
  ) {}

  public async resolve(trackId: string): Promise<StreamableFile> {
    const track = await this.repository.findAvailableById(trackId);
    if (track === null) throw new TrackNotFoundError();

    const absolutePath = await this.fileSystem.resolveSecurePath(
      track.libraryRootPath,
      track.relativePath,
    );
    const details = await this.fileSystem.stat(absolutePath);
    if (!details.isFile || !Number.isSafeInteger(details.size) || details.size < 0) {
      throw new TrackFileUnavailableError();
    }

    return {
      absolutePath,
      contentType: this.mimeTypes.fromPath(track.relativePath),
      size: details.size,
    };
  }

  public async open(trackId: string, rangeHeader?: string): Promise<OpenedTrackStream> {
    const file = await this.resolve(trackId);
    const range = rangeHeader === undefined ? null : parseByteRange(rangeHeader, file.size);
    const stream = range === null
      ? this.fileSystem.open(file.absolutePath)
      : this.fileSystem.open(file.absolutePath, range.start, range.end);
    return { ...file, range, stream };
  }
}
