import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ObsidianSyncInProgressError,
  SyncObsidianCatalogService,
  type ObsidianCatalogSource,
  type ObsidianVaultExporter,
} from '../src/application/obsidian/sync-catalog.js';
import type { ObsidianCatalogTrack, ObsidianSyncResult } from '../src/domain/obsidian/catalog.js';
import {
  noteFilename,
  sanitizeFilename,
  USER_BODY_END,
  USER_BODY_START,
} from '../src/domain/obsidian/note.js';
import {
  FilesystemObsidianVaultExporter,
  type AtomicNoteWriter,
} from '../src/infrastructure/obsidian/filesystem-vault-exporter.js';

const temporaryDirectories: string[] = [];
const track: ObsidianCatalogTrack = {
  album: { id: '22222222-2222-4222-8222-222222222222', title: 'Album/One' },
  artists: [{ id: '33333333-3333-4333-8333-333333333333', name: 'Artist: One' }],
  codec: 'FLAC',
  durationSeconds: 123.45,
  genres: [{ id: '44444444-4444-4444-8444-444444444444', name: 'Alt | Rock' }],
  id: '11111111-1111-4111-8111-111111111111',
  title: '../CON',
  year: 2024,
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe('Obsidian note naming', () => {
  it('sanitizes traversal, invalid characters, trailing dots, and Windows device names', () => {
    expect(sanitizeFilename('../a\\b:*?. ')).toBe('-a-b---');
    expect(sanitizeFilename('CON')).toBe('_CON');
    expect(sanitizeFilename('  ')).toBe('Untitled');
    expect(noteFilename('../track', '../id')).not.toMatch(/[\\/]/);
  });
});

describe('FilesystemObsidianVaultExporter', () => {
  it('creates deterministic relationship notes inside the vault', async () => {
    const root = await makeTempDirectory();
    const exporter = new FilesystemObsidianVaultExporter(root);

    const result = await exporter.exportCatalog([track]);

    expect(result).toEqual({ counts: { albums: 1, artists: 1, genres: 1, tracks: 1 }, errors: [] });
    const trackFiles = await readdir(path.join(root, 'Tracks'));
    expect(trackFiles).toEqual([noteFilename(track.title, track.id)]);
    const trackNote = await readFile(path.join(root, 'Tracks', trackFiles[0]!), 'utf8');
    expect(trackNote).toContain('codec: "FLAC"');
    expect(trackNote).toContain('[[Artists/Artist- One -- 33333333-3333-4333-8333-333333333333|Artist: One]]');
    expect(trackNote).toContain('[[Albums/Album-One -- 22222222-2222-4222-8222-222222222222|Album/One]]');
    expect(trackNote).toContain('tags: ["generated/obsidian-sync"]');

    const artistFile = (await readdir(path.join(root, 'Artists')))[0]!;
    const artistNote = await readFile(path.join(root, 'Artists', artistFile), 'utf8');
    expect(artistNote).toContain('[[Tracks/-CON -- 11111111-1111-4111-8111-111111111111|../CON]]');
  });

  it('preserves only the delimited user body and is idempotent', async () => {
    const root = await makeTempDirectory();
    const exporter = new FilesystemObsidianVaultExporter(root);
    await exporter.exportCatalog([track]);
    const target = path.join(root, 'Tracks', noteFilename(track.title, track.id));
    const generated = await readFile(target, 'utf8');
    const edited = generated
      .replace('year: 2024', 'year: 1900')
      .replace(`${USER_BODY_START}\n`, `${USER_BODY_START}\nMy annotations\n`);
    await import('node:fs/promises').then(({ writeFile }) => writeFile(target, edited));

    await exporter.exportCatalog([track]);
    const firstResync = await readFile(target, 'utf8');
    await exporter.exportCatalog([track]);
    const secondResync = await readFile(target, 'utf8');

    expect(firstResync).toContain('year: 2024');
    expect(firstResync).toContain(`${USER_BODY_START}\nMy annotations\n${USER_BODY_END}`);
    expect(secondResync).toBe(firstResync);
  });

  it('reports write failures without replacing the original content', async () => {
    const root = await makeTempDirectory();
    const writer = new FailingAtomicWriter('original');
    const exporter = new FilesystemObsidianVaultExporter(root, writer);

    const result = await exporter.exportCatalog([track]);

    expect(result.counts).toEqual({ albums: 0, artists: 0, genres: 0, tracks: 0 });
    expect(result.errors).toHaveLength(4);
    expect(writer.content).toBe('original');
  });
});

describe('SyncObsidianCatalogService', () => {
  it('rejects concurrent syncs and releases its guard afterward', async () => {
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const source: ObsidianCatalogSource = { findAllAvailableTracks: async () => [track] };
    const expected: ObsidianSyncResult = {
      counts: { albums: 1, artists: 1, genres: 1, tracks: 1 }, errors: [],
    };
    const exporter: ObsidianVaultExporter = {
      exportCatalog: async () => { await blocked; return expected; },
    };
    const service = new SyncObsidianCatalogService(source, exporter);

    const first = service.execute();
    await expect(service.execute()).rejects.toBeInstanceOf(ObsidianSyncInProgressError);
    release?.();
    await expect(first).resolves.toEqual(expected);
  });
});

class FailingAtomicWriter implements AtomicNoteWriter {
  public constructor(public content: string) {}
  public async read(): Promise<string> { return this.content; }
  public async write(): Promise<void> { throw new Error('simulated rename failure'); }
}

async function makeTempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'obsidian-sync-'));
  temporaryDirectories.push(directory);
  return directory;
}
