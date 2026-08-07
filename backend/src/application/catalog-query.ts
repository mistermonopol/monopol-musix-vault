import type { CatalogPage, CatalogTrack } from '../domain/catalog.js';

export interface CatalogPaginationInput {
  readonly page: number;
  readonly pageSize: number;
}

export interface CatalogSearchInput {
  readonly search?: string;
}

export type CatalogQueryInput = CatalogPaginationInput & CatalogSearchInput;

export interface CatalogRepositoryQuery {
  readonly limit: number;
  readonly offset: number;
  readonly search: string | null;
}

export interface CatalogRepositoryResult {
  readonly items: readonly CatalogTrack[];
  readonly total: number;
}

export interface CatalogRepository {
  findAvailableTracks(query: CatalogRepositoryQuery): Promise<CatalogRepositoryResult>;
}

export class InvalidCatalogQueryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidCatalogQueryError';
  }
}

export interface CatalogQueryOperations {
  execute(input: CatalogQueryInput): Promise<CatalogPage>;
}

export class CatalogQueryService implements CatalogQueryOperations {
  public constructor(private readonly repository: CatalogRepository) {}

  public async execute(input: CatalogQueryInput): Promise<CatalogPage> {
    assertPositiveInteger(input.page, 'page');
    assertPositiveInteger(input.pageSize, 'pageSize');

    const search = input.search?.trim() || null;
    const result = await this.repository.findAvailableTracks({
      limit: input.pageSize,
      offset: (input.page - 1) * input.pageSize,
      search,
    });

    return {
      items: result.items,
      page: input.page,
      pageSize: input.pageSize,
      total: result.total,
    };
  }
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new InvalidCatalogQueryError(`${field} must be a positive integer`);
  }
}
