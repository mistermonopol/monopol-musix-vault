import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import type { StreamFileDetails, TrackFileSystem } from '../../application/streaming-ports.js';

export class UnsafeTrackPathError extends Error {
  public constructor() {
    super('Track path escapes the configured library root');
    this.name = 'UnsafeTrackPathError';
  }
}

export class NodeTrackFileSystem implements TrackFileSystem {
  public async resolveSecurePath(libraryRootPath: string, relativePath: string): Promise<string> {
    assertRelativePath(relativePath);

    const root = await realpath(libraryRootPath);
    const candidate = await realpath(path.resolve(root, relativePath));
    if (!isWithin(root, candidate)) throw new UnsafeTrackPathError();
    return candidate;
  }

  public async stat(absolutePath: string): Promise<StreamFileDetails> {
    const details = await stat(absolutePath);
    return { isFile: details.isFile(), size: details.size };
  }

  public open(absolutePath: string, start?: number, end?: number): NodeJS.ReadableStream {
    if (start === undefined || end === undefined) return createReadStream(absolutePath);
    return createReadStream(absolutePath, { start, end });
  }
}

function assertRelativePath(relativePath: string): void {
  if (
    relativePath.length === 0
    || relativePath.includes('\0')
    || path.posix.isAbsolute(relativePath)
    || path.win32.isAbsolute(relativePath)
    || relativePath.split(/[\\/]/u).includes('..')
  ) {
    throw new UnsafeTrackPathError();
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
