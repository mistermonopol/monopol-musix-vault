import type { AvailableTrackFile } from '../domain/streaming.js';

export interface StreamFileDetails {
  readonly isFile: boolean;
  readonly size: number;
}

export interface TrackFileRepository {
  findAvailableById(trackId: string): Promise<AvailableTrackFile | null>;
}

export interface TrackFileSystem {
  resolveSecurePath(libraryRootPath: string, relativePath: string): Promise<string>;
  stat(absolutePath: string): Promise<StreamFileDetails>;
  open(absolutePath: string, start?: number, end?: number): NodeJS.ReadableStream;
}

export interface AudioMimeTypeResolver {
  fromPath(filePath: string): string;
}
