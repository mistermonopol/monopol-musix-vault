import type { FastifyInstance } from 'fastify';

import {
  ScanAlreadyRunningError,
  type MusicScannerOperations,
} from '../../application/music-scanner.js';
import type { TokenService } from '../../application/auth-ports.js';
import { authenticate } from './auth-routes.js';

interface LibraryRoutesDependencies {
  readonly scanner: MusicScannerOperations;
  readonly tokenService: TokenService;
}

export async function registerLibraryRoutes(
  app: FastifyInstance,
  dependencies: LibraryRoutesDependencies,
): Promise<void> {
  app.post('/library/scan', async (request, reply) => {
    await authenticate(request, dependencies.tokenService);
    try {
      const result = await dependencies.scanner.scan((progress) => {
        request.log.info({ progress }, 'Music scan progress');
      });
      return reply.send(result);
    } catch (error: unknown) {
      if (error instanceof ScanAlreadyRunningError) {
        return reply.status(409).send({
          code: 'SCAN_ALREADY_RUNNING',
          error: error.message,
          statusCode: 409,
        });
      }
      throw error;
    }
  });
}
