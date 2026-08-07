import type { ByteRange } from './byte-range.js';

export interface AvailableTrackFile {
  readonly libraryRootPath: string;
  readonly relativePath: string;
}

export interface StreamableFile {
  readonly absolutePath: string;
  readonly contentType: string;
  readonly size: number;
}

export interface OpenedTrackStream extends StreamableFile {
  readonly range: ByteRange | null;
  readonly stream: NodeJS.ReadableStream;
}
