import type { ObsidianCatalogTrack, ObsidianSyncResult } from '../../domain/obsidian/catalog.js';

export interface ObsidianCatalogSource {
  findAllAvailableTracks(): Promise<readonly ObsidianCatalogTrack[]>;
}

export interface ObsidianVaultExporter {
  exportCatalog(tracks: readonly ObsidianCatalogTrack[]): Promise<ObsidianSyncResult>;
}

export class ObsidianSyncInProgressError extends Error {
  public constructor() {
    super('An Obsidian catalog sync is already in progress');
    this.name = 'ObsidianSyncInProgressError';
  }
}

export interface ObsidianSyncOperations {
  execute(): Promise<ObsidianSyncResult>;
}

export class SyncObsidianCatalogService implements ObsidianSyncOperations {
  private running = false;

  public constructor(
    private readonly source: ObsidianCatalogSource,
    private readonly exporter: ObsidianVaultExporter,
  ) {}

  public async execute(): Promise<ObsidianSyncResult> {
    if (this.running) throw new ObsidianSyncInProgressError();
    this.running = true;
    try {
      const tracks = await this.source.findAllAvailableTracks();
      return await this.exporter.exportCatalog(tracks);
    } finally {
      this.running = false;
    }
  }
}
