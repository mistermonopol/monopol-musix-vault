import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

import type { ObsidianVaultExporter } from '../../application/obsidian/sync-catalog.js';
import type {
  ObsidianCatalogTrack,
  ObsidianSyncCounts,
  ObsidianSyncError,
  ObsidianSyncResult,
} from '../../domain/obsidian/catalog.js';
import {
  type CatalogEntityNote,
  noteFilename,
  preserveUserBody,
  renderEntityNote,
  renderTrackNote,
} from '../../domain/obsidian/note.js';

export interface AtomicNoteWriter {
  read(target: string): Promise<string | null>;
  write(target: string, content: string): Promise<void>;
}

export class NodeAtomicNoteWriter implements AtomicNoteWriter {
  public async read(target: string): Promise<string | null> {
    try {
      const metadata = await lstat(target);
      if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error(`Unsafe note target: ${target}`);
      return await readFile(target, 'utf8');
    } catch (error: unknown) {
      if (isNodeError(error, 'ENOENT')) return null;
      throw error;
    }
  }

  public async write(target: string, content: string): Promise<void> {
    const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
    let created = false;
    try {
      const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      created = true;
      try {
        await handle.writeFile(content, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(temporary, target);
      created = false;
    } finally {
      if (created) await unlink(temporary).catch(() => undefined);
    }
  }
}

interface WritableNote {
  readonly directory: 'Tracks' | 'Artists' | 'Albums' | 'Genres';
  readonly id: string;
  readonly name: string;
  readonly render: (body: string) => string;
  readonly type: 'track' | 'artist' | 'album' | 'genre';
}

export class FilesystemObsidianVaultExporter implements ObsidianVaultExporter {
  public constructor(
    private readonly vaultRoot: string,
    private readonly writer: AtomicNoteWriter = new NodeAtomicNoteWriter(),
  ) {}

  public async exportCatalog(tracks: readonly ObsidianCatalogTrack[]): Promise<ObsidianSyncResult> {
    const root = await prepareVaultRoot(this.vaultRoot);
    await Promise.all(['Tracks', 'Artists', 'Albums', 'Genres'].map((directory) => prepareDirectory(root, directory)));

    const errors: ObsidianSyncError[] = [];
    const counts: Record<keyof ObsidianSyncCounts, number> = { albums: 0, artists: 0, genres: 0, tracks: 0 };
    const notes = buildNotes(tracks);

    const batchSize = 8;
    for (let index = 0; index < notes.length; index += batchSize) {
      await Promise.all(notes.slice(index, index + batchSize).map(async (note) => {
        const target = safeChildPath(root, note.directory, noteFilename(note.name, note.id));
        try {
          const existing = await this.writer.read(target);
          await this.writer.write(target, note.render(preserveUserBody(existing)));
          counts[`${note.type}s` as keyof ObsidianSyncCounts] += 1;
        } catch (error: unknown) {
          errors.push({ message: errorMessage(error), noteId: note.id, noteType: note.type });
        }
      }));
    }

    return { counts, errors };
  }
}

function buildNotes(tracks: readonly ObsidianCatalogTrack[]): WritableNote[] {
  const notes: WritableNote[] = tracks.map((track) => ({
    directory: 'Tracks', id: track.id, name: track.title, type: 'track',
    render: (body) => renderTrackNote(track, body),
  }));
  const entities = new Map<string, CatalogEntityNote>();
  for (const track of tracks) {
    for (const artist of track.artists) addEntity(entities, 'artist', artist.id, artist.name, track);
    if (track.album !== null) addEntity(entities, 'album', track.album.id, track.album.title, track);
    for (const genre of track.genres) addEntity(entities, 'genre', genre.id, genre.name, track);
  }
  for (const entity of entities.values()) {
    const directory = entity.type === 'artist' ? 'Artists' : entity.type === 'album' ? 'Albums' : 'Genres';
    notes.push({
      directory, id: entity.id, name: entity.name, type: entity.type,
      render: (body) => renderEntityNote(entity, body),
    });
  }
  return notes.sort((left, right) => left.directory.localeCompare(right.directory)
    || left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
}

function addEntity(
  entities: Map<string, CatalogEntityNote>,
  type: CatalogEntityNote['type'],
  id: string,
  name: string,
  track: ObsidianCatalogTrack,
): void {
  const key = `${type}:${id}`;
  const current = entities.get(key);
  entities.set(key, current === undefined
    ? { id, name, tracks: [track], type }
    : { ...current, tracks: [...current.tracks, track] });
}

async function prepareVaultRoot(configuredRoot: string): Promise<string> {
  const absolute = path.resolve(configuredRoot);
  await mkdir(absolute, { recursive: true });
  const metadata = await lstat(absolute);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error('Vault root must be a real directory');
  return realpath(absolute);
}

async function prepareDirectory(root: string, directory: string): Promise<void> {
  const target = safeChildPath(root, directory);
  await mkdir(target, { recursive: true });
  const metadata = await lstat(target);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error(`Unsafe vault directory: ${directory}`);
  const canonical = await realpath(target);
  if (!isInside(root, canonical)) throw new Error(`Vault directory escapes root: ${directory}`);
}

function safeChildPath(root: string, ...parts: readonly string[]): string {
  const target = path.resolve(root, ...parts);
  if (!isInside(root, target)) throw new Error('Note path escapes the canonical vault root');
  return target;
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
