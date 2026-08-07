import path from 'node:path';

import { parseFile } from 'music-metadata';

import type { AudioMetadataReader } from '../../application/scanner-ports.js';
import type { NumberPair, TrackMetadata } from '../../domain/track.js';

export class MusicMetadataReader implements AudioMetadataReader {
  public async read(absolutePath: string): Promise<TrackMetadata> {
    const { common, format } = await parseFile(absolutePath, { duration: true });
    return {
      album: clean(common.album),
      albumArtists: uniqueStrings(common.albumartist === undefined ? [] : [common.albumartist]),
      artists: uniqueStrings(common.artists ?? (common.artist === undefined ? [] : [common.artist])),
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
