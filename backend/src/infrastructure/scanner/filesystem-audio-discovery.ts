import { opendir, stat } from 'node:fs/promises';
import path from 'node:path';

import type { AudioFileDiscovery, DiscoveredAudioFile } from '../../application/scanner-ports.js';
import type { LibraryRoot } from '../../domain/music.js';

const SUPPORTED_EXTENSIONS = new Set([
  '.aac', '.aif', '.aiff', '.alac', '.ape', '.flac', '.m4a', '.m4b', '.mp2', '.mp3',
  '.mp4', '.oga', '.ogg', '.opus', '.wav', '.wave', '.webm', '.wma', '.wv',
]);

export class FilesystemAudioDiscovery implements AudioFileDiscovery {
  public async *discover(root: LibraryRoot): AsyncIterable<DiscoveredAudioFile> {
    yield* this.walk(root, root.path);
  }

  private async *walk(root: LibraryRoot, directoryPath: string): AsyncIterable<DiscoveredAudioFile> {
    const directory = await opendir(directoryPath);
    for await (const entry of directory) {
      const absolutePath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        yield* this.walk(root, absolutePath);
      } else if (entry.isFile() && isSupportedAudioPath(entry.name)) {
        const details = await stat(absolutePath);
        yield {
          absolutePath,
          libraryRootId: root.id,
          modifiedAt: details.mtime,
          relativePath: path.relative(root.path, absolutePath),
          size: details.size,
        };
      }
    }
  }
}

export function isSupportedAudioPath(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}
