import { describe, expect, it } from 'vitest';

import {
  CatalogQueryService,
  InvalidCatalogQueryError,
  type CatalogRepository,
  type CatalogRepositoryQuery,
  type CatalogRepositoryResult,
} from '../src/application/catalog-query.js';
import type { CatalogTrack } from '../src/domain/catalog.js';

const track: CatalogTrack = {
  album: { id: 'album-1', title: 'The Album' },
  artists: [{ id: 'artist-1', name: 'The Artist' }],
  codec: 'FLAC',
  durationSeconds: 213.5,
  genres: [{ id: 'genre-1', name: 'Electronic' }],
  hasArtwork: true,
  id: 'track-1',
  title: 'The Track',
  year: 2025,
};

class FakeCatalogRepository implements CatalogRepository {
  public query: CatalogRepositoryQuery | null = null;
  public result: CatalogRepositoryResult = { items: [track], total: 21 };

  public async findAvailableTracks(query: CatalogRepositoryQuery): Promise<CatalogRepositoryResult> {
    this.query = query;
    return this.result;
  }
}

describe('CatalogQueryService', () => {
  it('translates page input to repository pagination and returns page metadata', async () => {
    const repository = new FakeCatalogRepository();
    const service = new CatalogQueryService(repository);

    const result = await service.execute({ page: 3, pageSize: 10, search: '  artist  ' });

    expect(repository.query).toEqual({ limit: 10, offset: 20, search: 'artist' });
    expect(result).toEqual({ items: [track], page: 3, pageSize: 10, total: 21 });
  });

  it('normalizes an omitted or blank search to null', async () => {
    const repository = new FakeCatalogRepository();
    const service = new CatalogQueryService(repository);

    await service.execute({ page: 1, pageSize: 25, search: '   ' });

    expect(repository.query).toEqual({ limit: 25, offset: 0, search: null });
  });

  it.each([
    { page: 0, pageSize: 10 },
    { page: 1.5, pageSize: 10 },
    { page: 1, pageSize: 0 },
    { page: 1, pageSize: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid pagination: %o', async (input) => {
    const service = new CatalogQueryService(new FakeCatalogRepository());

    await expect(service.execute(input)).rejects.toBeInstanceOf(InvalidCatalogQueryError);
  });
});
