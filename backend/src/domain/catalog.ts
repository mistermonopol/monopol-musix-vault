export interface CatalogAlbum {
  readonly id: string;
  readonly title: string;
}

export interface CatalogArtist {
  readonly id: string;
  readonly name: string;
}

export interface CatalogGenre {
  readonly id: string;
  readonly name: string;
}

export interface CatalogTrack {
  readonly album: CatalogAlbum | null;
  readonly artists: readonly CatalogArtist[];
  readonly codec: string | null;
  readonly durationSeconds: number | null;
  readonly genres: readonly CatalogGenre[];
  readonly hasArtwork: boolean;
  readonly id: string;
  readonly title: string;
  readonly year: number | null;
}

export interface CatalogPage {
  readonly items: readonly CatalogTrack[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}
