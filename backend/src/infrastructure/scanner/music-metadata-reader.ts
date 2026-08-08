import path from 'node:path';

import { parseFile } from 'music-metadata';

import type { AudioMetadataReader } from '../../application/scanner-ports.js';
import type { EmbeddedArtwork, NumberPair, TrackMetadata } from '../../domain/track.js';

export const MAX_ARTWORK_BYTES = 5 * 1024 * 1024;

export class MusicMetadataReader implements AudioMetadataReader {
  public async read(absolutePath: string): Promise<TrackMetadata> {
    const { common, format } = await parseFile(absolutePath, { duration: true });
    return {
      album: clean(common.album),
      albumArtists: uniqueStrings(common.albumartist === undefined ? [] : [common.albumartist]),
      artists: uniqueStrings(common.artists ?? (common.artist === undefined ? [] : [common.artist])),
      artwork: selectEmbeddedArtwork(common.picture ?? []),
      bitrate: finiteInteger(format.bitrate),
      codec: clean(format.codec),
      container: clean(format.container),
      disc: pair(common.disk.no, common.disk.of),
      durationSeconds: finiteNumber(format.duration),
      genres: uniqueStrings(common.genre ?? []),
      sampleRate: finiteInteger(format.sampleRate),
      title: clean(common.title) ?? path.parse(absolutePath).name,
      track: pair(common.track.no, common.track.of),
      year: validYear(common.year),
    };
  }
}

export function selectEmbeddedArtwork(pictures: readonly { data: Uint8Array; format: string }[]): EmbeddedArtwork | null {
  for (const picture of pictures) {
    const mimeType = supportedImageMime(picture.format);
    if (mimeType === null || picture.data.byteLength === 0 || picture.data.byteLength > MAX_ARTWORK_BYTES) continue;
    const data = Buffer.from(picture.data);
    if (matchesSignature(data, mimeType)) return { data, mimeType };
  }
  return null;
}

function supportedImageMime(value: string): EmbeddedArtwork['mimeType'] | null {
  const normalized = value.trim().toLocaleLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg' || normalized === 'jpeg' || normalized === 'jpg') return 'image/jpeg';
  if (normalized === 'image/png' || normalized === 'png') return 'image/png';
  if (normalized === 'image/webp' || normalized === 'webp') return 'image/webp';
  return null;
}

function matchesSignature(data: Buffer, mimeType: EmbeddedArtwork['mimeType']): boolean {
  if (mimeType === 'image/jpeg') return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (mimeType === 'image/png') return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP';
}

function clean(value: string | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned === undefined || cleaned.length === 0 ? null : cleaned;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  const result = new Map<string, string>();
  for (const value of values) {
    const cleaned = value.trim();
    if (cleaned.length > 0 && !result.has(cleaned.toLocaleLowerCase())) {
      result.set(cleaned.toLocaleLowerCase(), cleaned);
    }
  }
  return [...result.values()];
}

function finiteNumber(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : null;
}

function finiteInteger(value: number | undefined): number | null {
  const number = finiteNumber(value);
  return number === null ? null : Math.round(number);
}

function pair(number: number | null, total: number | null): NumberPair {
  return { number: positiveInteger(number), total: positiveInteger(total) };
}

function positiveInteger(value: number | null): number | null {
  return value !== null && Number.isInteger(value) && value > 0 ? value : null;
}

function validYear(value: number | undefined): number | null {
  return value !== undefined && Number.isInteger(value) && value >= 1000 && value <= 9999
    ? value
    : null;
}
