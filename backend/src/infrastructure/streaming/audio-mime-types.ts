import path from 'node:path';

import type { AudioMimeTypeResolver } from '../../application/streaming-ports.js';

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.aac': 'audio/aac',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.alac': 'audio/mp4',
  '.ape': 'audio/ape',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.m4b': 'audio/mp4',
  '.mp2': 'audio/mpeg',
  '.mp3': 'audio/mpeg',
  '.mp4': 'audio/mp4',
  '.oga': 'audio/ogg',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.wave': 'audio/wav',
  '.webm': 'audio/webm',
  '.wma': 'audio/x-ms-wma',
  '.wv': 'audio/wavpack',
};

export class SupportedAudioMimeTypes implements AudioMimeTypeResolver {
  public fromPath(filePath: string): string {
    return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  }
}

export function audioMimeType(filePath: string): string {
  return new SupportedAudioMimeTypes().fromPath(filePath);
}
