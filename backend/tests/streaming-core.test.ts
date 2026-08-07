import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import type { AudioMimeTypeResolver, TrackFileRepository, TrackFileSystem } from '../src/application/streaming-ports.js';
import { TrackNotFoundError, TrackStreamingService } from '../src/application/track-streaming-service.js';
import { audioMimeType } from '../src/infrastructure/streaming/audio-mime-types.js';
import { NodeTrackFileSystem, UnsafeTrackPathError } from '../src/infrastructure/streaming/node-track-file-system.js';

const repository: TrackFileRepository = {
  findAvailableById: async () => ({ libraryRootPath: '/music', relativePath: 'album/song.mp3' }),
};
const mimeTypes: AudioMimeTypeResolver = { fromPath: () => 'audio/mpeg' };

describe('TrackStreamingService', () => {
  it('resolves, stats, and opens an inclusive partial stream through its ports', async () => {
    const stream = Readable.from('bytes');
    const fileSystem: TrackFileSystem = {
      resolveSecurePath: vi.fn(async () => '/music/album/song.mp3'),
      stat: vi.fn(async () => ({ isFile: true, size: 100 })),
      open: vi.fn(() => stream),
    };
    const service = new TrackStreamingService(repository, fileSystem, mimeTypes);

    const result = await service.open('44ab42c1-10e7-4f16-953f-801c3c24f432', 'bytes=10-19');

    expect(result).toMatchObject({
      absolutePath: '/music/album/song.mp3', contentType: 'audio/mpeg', size: 100,
      range: { start: 10, end: 19, length: 10 },
    });
    expect(result.stream).toBe(stream);
    expect(fileSystem.open).toHaveBeenCalledWith('/music/album/song.mp3', 10, 19);
  });

  it('opens the whole file when no range is supplied', async () => {
    const fileSystem: TrackFileSystem = {
      resolveSecurePath: async () => '/music/song.mp3',
      stat: async () => ({ isFile: true, size: 1 }),
      open: vi.fn(() => Readable.from('x')),
    };
    const result = await new TrackStreamingService(repository, fileSystem, mimeTypes).open('id');
    expect(result.range).toBeNull();
    expect(fileSystem.open).toHaveBeenCalledWith('/music/song.mp3');
  });

  it('does not touch the filesystem when an available track cannot be found', async () => {
    const fileSystem: TrackFileSystem = {
      resolveSecurePath: vi.fn(), stat: vi.fn(), open: vi.fn(),
    };
    const missing: TrackFileRepository = { findAvailableById: async () => null };
    await expect(new TrackStreamingService(missing, fileSystem, mimeTypes).resolve('id'))
      .rejects.toBeInstanceOf(TrackNotFoundError);
    expect(fileSystem.resolveSecurePath).not.toHaveBeenCalled();
  });
});

describe('NodeTrackFileSystem', () => {
  it('resolves a nested file under its real library root and reports its size', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mmv-stream-root-'));
    await mkdir(path.join(root, 'album'));
    await writeFile(path.join(root, 'album', 'song.mp3'), 'hello');
    const fileSystem = new NodeTrackFileSystem();
    const resolved = await fileSystem.resolveSecurePath(root, path.join('album', 'song.mp3'));
    await expect(fileSystem.stat(resolved)).resolves.toEqual({ isFile: true, size: 5 });
  });

  it.each(['../secret.mp3', '..\\secret.mp3', '/secret.mp3', 'C:\\secret.mp3', '']) (
    'rejects unsafe relative path %j',
    async (relativePath) => {
      const fileSystem = new NodeTrackFileSystem();
      await expect(fileSystem.resolveSecurePath(tmpdir(), relativePath)).rejects.toBeInstanceOf(UnsafeTrackPathError);
    },
  );

  it('rejects a symlink whose real target is outside the root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'mmv-stream-root-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'mmv-stream-outside-'));
    await writeFile(path.join(outside, 'secret.mp3'), 'secret');
    await symlink(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(new NodeTrackFileSystem().resolveSecurePath(root, path.join('linked', 'secret.mp3')))
      .rejects.toBeInstanceOf(UnsafeTrackPathError);
  });
});

describe('audioMimeType', () => {
  it.each([
    ['x.aac', 'audio/aac'], ['x.AIFF', 'audio/aiff'], ['x.alac', 'audio/mp4'],
    ['x.ape', 'audio/ape'], ['x.flac', 'audio/flac'], ['x.m4a', 'audio/mp4'],
    ['x.m4b', 'audio/mp4'], ['x.mp2', 'audio/mpeg'], ['x.mp3', 'audio/mpeg'],
    ['x.mp4', 'audio/mp4'], ['x.oga', 'audio/ogg'], ['x.ogg', 'audio/ogg'],
    ['x.opus', 'audio/ogg'], ['x.wav', 'audio/wav'], ['x.wave', 'audio/wav'],
    ['x.webm', 'audio/webm'], ['x.wma', 'audio/x-ms-wma'], ['x.wv', 'audio/wavpack'],
  ])('maps %s to %s', (file, expected) => expect(audioMimeType(file)).toBe(expected));

  it('uses a safe fallback for an unexpected extension', () => {
    expect(audioMimeType('cover.jpg')).toBe('application/octet-stream');
  });
});
