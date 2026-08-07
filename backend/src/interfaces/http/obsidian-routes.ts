import type { FastifyInstance } from 'fastify';

import type { TokenService } from '../../application/auth-ports.js';
import {
  ObsidianSyncInProgressError,
  type ObsidianSyncOperations,
} from '../../application/obsidian/sync-catalog.js';
import { authenticate } from './auth-routes.js';

interface ObsidianRoutesDependencies {
  readonly obsidianSync: ObsidianSyncOperations;
  readonly tokenService: TokenService;
}

export async function registerObsidianRoutes(
  app: FastifyInstance,
  dependencies: ObsidianRoutesDependencies,
): Promise<void> {
  app.post('/brain/sync', async (request, reply) => {
    await authenticate(request, dependencies.tokenService);
    try {
      return reply.send(await dependencies.obsidianSync.execute());
    } catch (error: unknown) {
      if (error instanceof ObsidianSyncInProgressError) {
        return reply.status(409).send({
          code: 'OBSIDIAN_SYNC_IN_PROGRESS',
          error: error.message,
          statusCode: 409,
        });
      }
      throw error;
    }
  });
}
