import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { TokenService } from '../../application/auth-ports.js';
import type { TrackArtworkOperations } from '../../application/track-artwork.js';
import { authenticate } from './auth-routes.js';

const paramsSchema = z.object({ trackId: z.string().uuid() });

export async function registerArtworkRoutes(
  app: FastifyInstance,
  dependencies: { readonly artwork: TrackArtworkOperations; readonly tokenService: TokenService },
): Promise<void> {
  app.get('/tracks/:trackId/artwork', async (request, reply) => {
    await authenticate(request, dependencies.tokenService);
    const { trackId } = paramsSchema.parse(request.params);
    const artwork = await dependencies.artwork.get(trackId);
    if (artwork === null) {
      return reply.status(404).send({
        code: 'ARTWORK_NOT_FOUND',
        error: 'Artwork not found',
        statusCode: 404,
      });
    }

    return reply
      .header('Cache-Control', 'private, max-age=86400')
      .header('Content-Length', artwork.data.length)
      .header('Content-Type', artwork.mimeType)
      .header('X-Content-Type-Options', 'nosniff')
      .send(artwork.data);
  });
}
