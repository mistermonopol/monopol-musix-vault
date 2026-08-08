import rateLimit from '@fastify/rate-limit';
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
  LogController,
} from 'fastify';
import { ZodError } from 'zod';

import { AuthError } from './application/auth-errors.js';
import type { AuthRepository, TokenService } from './application/auth-ports.js';
import type { AuthOperations } from './application/auth-service.js';
import type { CatalogQueryOperations } from './application/catalog-query.js';
import type { DatabaseHealth } from './application/database-health.js';
import type { BrainGraphOperations } from './application/brain-graph.js';
import type { DeviceOperations, ListeningOperations, PlaylistOperations, QueueOperations } from './application/user-data.js';
import { GetHealth } from './application/get-health.js';
import type { MusicScannerOperations } from './application/music-scanner.js';
import type { ObsidianSyncOperations } from './application/obsidian/sync-catalog.js';
import type { TrackStreamingOperations } from './application/track-streaming-service.js';
import { TrackNotFoundError, type TrackFavoritesOperations } from './application/track-favorites.js';
import { createAccessCodeGate } from './infrastructure/access-code.js';
import type { AppConfig } from './infrastructure/config.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { registerAuthRoutes } from './interfaces/http/auth-routes.js';
import { registerBrainGraphRoutes } from './interfaces/http/brain-graph-routes.js';
import { registerUserDataRoutes } from './interfaces/http/user-data-routes.js';
import { registerCatalogRoutes } from './interfaces/http/catalog-routes.js';
import { registerFavoritesRoutes } from './interfaces/http/favorites-routes.js';
import { registerHealthRoutes } from './interfaces/http/health-routes.js';
import { registerLibraryRoutes } from './interfaces/http/library-routes.js';
import { registerObsidianRoutes } from './interfaces/http/obsidian-routes.js';
import { registerStreamingRoutes } from './interfaces/http/streaming-routes.js';

export interface BuildAppOptions {
  readonly authRepository: AuthRepository;
  readonly authService: AuthOperations;
  readonly catalog: CatalogQueryOperations;
  readonly config: AppConfig;
  readonly databaseHealth: DatabaseHealth;
  readonly devices?: DeviceOperations;
  readonly favorites: TrackFavoritesOperations;
  readonly graph?: BrainGraphOperations;
  readonly listening?: ListeningOperations;
  readonly logger?: FastifyServerOptions['logger'];
  readonly obsidianSync: ObsidianSyncOperations;
  readonly playlists?: PlaylistOperations;
  readonly queues?: QueueOperations;
  readonly scanner: MusicScannerOperations;
  readonly streaming: TrackStreamingOperations;
  readonly tokenService: TokenService;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logController: new LogController({
      disableRequestLogging: options.config.NODE_ENV === 'test',
    }),
    logger:
      options.logger ??
      (options.config.NODE_ENV === 'test'
        ? false
        : {
            level: options.config.LOG_LEVEL,
            redact: ['req.headers.x-access-code'],
          }),
  });

  app.addHook('onRequest', createAccessCodeGate(options.config.accessCode));

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AuthError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        error: error.message,
        statusCode: error.statusCode,
      });
    }
    if (error instanceof TrackNotFoundError) {
      return reply.status(404).send({
        code: 'TRACK_NOT_FOUND',
        error: error.message,
        statusCode: 404,
      });
    }
    if (error instanceof ZodError) {
      return reply.status(400).send({
        code: 'INVALID_REQUEST',
        error: 'Request validation failed',
        statusCode: 400,
      });
    }

    request.log.error({ error, requestId: request.id }, 'Request failed');
    return reply.status(500).send({
      error: 'Internal Server Error',
      requestId: request.id,
      statusCode: 500,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: 'Not Found',
      path: request.url,
      statusCode: 404,
    });
  });

  await app.register(rateLimit, { global: false });

  const getHealth = new GetHealth(new SystemClock(), '0.1.0');
  await app.register(registerHealthRoutes, {
    databaseHealth: options.databaseHealth,
    getHealth,
  });
  await app.register(registerAuthRoutes, {
    authRepository: options.authRepository,
    authService: options.authService,
    tokenService: options.tokenService,
  });
  await app.register(registerCatalogRoutes, {
    catalog: options.catalog,
    tokenService: options.tokenService,
  });
  await app.register(registerFavoritesRoutes, {
    favorites: options.favorites,
    tokenService: options.tokenService,
  });
  await app.register(registerLibraryRoutes, {
    scanner: options.scanner,
    tokenService: options.tokenService,
  });
  await app.register(registerObsidianRoutes, {
    obsidianSync: options.obsidianSync,
    tokenService: options.tokenService,
  });
  if (options.graph !== undefined) {
    await app.register(registerBrainGraphRoutes, { graph: options.graph, tokenService: options.tokenService });
  }
  if (options.devices !== undefined && options.listening !== undefined && options.playlists !== undefined && options.queues !== undefined) {
    await app.register(registerUserDataRoutes, {
      devices: options.devices,
      listening: options.listening,
      playlists: options.playlists,
      queues: options.queues,
      tokenService: options.tokenService,
    });
  }
  await app.register(registerStreamingRoutes, {
    streaming: options.streaming,
    tokenService: options.tokenService,
  });

  return app;
}
