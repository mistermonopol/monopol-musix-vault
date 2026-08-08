import { describe, expect, it } from 'vitest';

import { MAX_ARTWORK_BYTES, selectEmbeddedArtwork } from '../src/infrastructure/scanner/music-metadata-reader.js';

const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
]);

describe('embedded artwork validation', () => {
  it.each([
    ['image/jpeg', jpeg, 'image/jpeg'],
    ['image/png', png, 'image/png'],
    ['image/webp', webp, 'image/webp'],
    ['jpg', jpeg, 'image/jpeg'],
  ] as const)('accepts supported %s artwork with a matching signature', (format, data, expected) => {
    expect(selectEmbeddedArtwork([{ data, format }])).toEqual({ data: Buffer.from(data), mimeType: expected });
  });

  it('rejects unsupported, spoofed, empty, and oversized images', () => {
    expect(selectEmbeddedArtwork([{ data: jpeg, format: 'image/gif' }])).toBeNull();
    expect(selectEmbeddedArtwork([{ data: Uint8Array.from([1, 2, 3]), format: 'image/jpeg' }])).toBeNull();
    expect(selectEmbeddedArtwork([{ data: new Uint8Array(), format: 'image/png' }])).toBeNull();
    expect(selectEmbeddedArtwork([{
      data: new Uint8Array(MAX_ARTWORK_BYTES + 1),
      format: 'image/jpeg',
    }])).toBeNull();
  });

  it('skips invalid pictures and selects the first safe supported image', () => {
    const selected = selectEmbeddedArtwork([
      { data: Uint8Array.from([1]), format: 'image/png' },
      { data: webp, format: 'image/webp' },
      { data: jpeg, format: 'image/jpeg' },
    ]);
    expect(selected?.mimeType).toBe('image/webp');
  });
});
