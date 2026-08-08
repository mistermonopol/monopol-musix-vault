import { buildApp } from './app.js';
import { ArtworkLookupService } from './application/artwork-lookup.js';
import { AuthService } from './application/auth-service.js';
import { CatalogQueryService } from './application/catalog-query.js';
import { MusicScanner } from './application/music-scanner.js';
import { SyncObsidianCatalogService } from './application/obsidian/sync-catalog.js';
import { TrackArtworkService } from './application/track-artwork.js';
import { TrackStreamingService } from './application/track-streaming-service.js';
import { TrackFavoritesService } from './application/track-favorites.js';
import { PostgresTrackArtworkRepository } from './infrastructure/artwork/postgres-track-artwork-repository.js';
import { ArgonPasswordHasher } from './infrastructure/auth/argon-password-hasher.js';
import { JwtTokenService } from './infrastructure/auth/jwt-token-service.js';
import { PostgresAuthRepository } from './infrastructure/auth/postgres-auth-repository.js';
import { PostgresCatalogRepository } from './infrastructure/catalog/postgres-catalog-repository.js';
import { loadConfig } from './infrastructure/config.js';
import { runMigrations } from './infrastructure/database/migrate.js';
import { PostgresDatabase } from './infrastructure/database/postgres-database.js';
import { PostgresTrackFavoritesRepository } from './infrastructure/favorites/postgres-track-favorites-repository.js';
import { MusicBrainzHttpArtworkProvider } from './infrastructure/musicbrainz/musicbrainz-artwork-provider.js';
import { PostgresArtworkLookupRepository } from './infrastructure/musicbrainz/postgres-artwork-lookup-repository.js';
import { FilesystemAudioDiscovery } from './infrastructure/scanner/filesystem-audio-discovery.js';
import { MusicMetadataReader } from './infrastructure/scanner/music-metadata-reader.js';
import { FilesystemObsidianVaultExporter } from './infrastructure/obsidian/filesystem-vault-exporter.js';
import { PostgresObsidianCatalogSource } from './infrastructure/obsidian/postgres-obsidian-catalog-source.js';
import { PostgresBrainGraph } from './infrastructure/obsidian/postgres-brain-graph.js';
import { PostgresDevices, PostgresListening, PostgresPlaylists, PostgresQueues } from './infrastructure/user-data/postgres-user-data.js';
import { PostgresMusicScanRepository } from './infrastructure/scanner/postgres-music-scan-repository.js';
import { SupportedAudioMimeTypes } from './infrastructure/streaming/audio-mime-types.js';
import { NodeTrackFileSystem } from './infrastructure/streaming/node-track-file-system.js';
import { PostgresTrackFileRepository } from './infrastructure/streaming/postgres-track-file-repository.js';

async function start(): Promise<void> {
  const config = loadConfig(process.env);
  const database = await PostgresDatabase.connect(config.database);

  try {
    await runMigrations(database.client, new URL('../migrations/', import.meta.url));
  } catch (error: unknown) {
    await database.close();
    throw error;
  }

  await database.client`
    INSERT INTO library_roots (path) VALUES (${config.LIBRARY_PATH})
    ON CONFLICT (path) DO UPDATE SET enabled = true, updated_at = now()
  `;

  const authRepository = new PostgresAuthRepository(database.client);
  const tokenService = new JwtTokenService(config.auth);
  const authService = new AuthService(
    authRepository,
    new ArgonPasswordHasher(),
    tokenService,
  );
  const artwork = new TrackArtworkService(new PostgresTrackArtworkRepository(database.client));
  const artworkLookup = new ArtworkLookupService(
    new PostgresArtworkLookupRepository(database.client),
    new MusicBrainzHttpArtworkProvider(
      config.artworkLookup.userAgent,
      config.artworkLookup.requestIntervalMs,
      config.artworkLookup.timeoutMs,
    ),
    config.artworkLookup.enabled,
    config.artworkLookup.batchSize,
  );
  const catalog = new CatalogQueryService(
    new PostgresCatalogRepository(database.client),
  );
  const favorites = new TrackFavoritesService(
    new PostgresTrackFavoritesRepository(database.client),
  );
  const listening = new PostgresListening(database.client);
  const playlists = new PostgresPlaylists(database.client);
  const devices = new PostgresDevices(database.client);
  const queues = new PostgresQueues(database.client);
  const graph = new PostgresBrainGraph(database.client);
  const obsidianSync = new SyncObsidianCatalogService(
    new PostgresObsidianCatalogSource(database.client),
    new FilesystemObsidianVaultExporter(config.OBSIDIAN_PATH),
  );
  const scanner = new MusicScanner(
    new PostgresMusicScanRepository(database.client),
    new FilesystemAudioDiscovery(),
    new MusicMetadataReader(),
  );
  const streaming = new TrackStreamingService(
    new PostgresTrackFileRepository(database.client),
    new NodeTrackFileSystem(),
    new SupportedAudioMimeTypes(),
  );
  const app = await buildApp({
    authRepository,
    authService,
    artwork,
    artworkLookup,
    catalog,
    config,
    databaseHealth: database,
    devices,
    favorites,
    graph,
    listening,
    obsidianSync,
    playlists,
    queues,
    scanner,
    streaming,
    tokenService,
  });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'Shutdown requested');
    await app.close();
    await database.close();
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.HOST, port: config.PORT });
}

start().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(
    `${JSON.stringify({ detail, level: 'fatal', message: 'Backend startup failed' })}\n`,
  );
  process.exitCode = 1;
});
