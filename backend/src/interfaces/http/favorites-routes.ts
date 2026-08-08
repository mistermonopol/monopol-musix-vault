import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { TokenService } from '../../application/auth-ports.js';
import type { TrackFavoritesOperations } from '../../application/track-favorites.js';
import { authenticate } from './auth-routes.js';

const paramsSchema = z.object({ trackId: z.string().uuid() });

interface FavoritesRoutesDependencies {
  readonly favorites: TrackFavoritesOperations;
  readonly tokenService: TokenService;
}

export async function registerFavoritesRoutes(
  app: FastifyInstance,
  dependencies: FavoritesRoutesDependencies,
): Promise<void> {
  app.get('/favorites/tracks', async (request, reply) => {
    const userId = await authenticate(request, dependencies.tokenService);
    return reply.send({ items: await dependencies.favorites.list(userId) });
  });

  app.put('/favorites/tracks/:trackId', async (request, reply) => {
    const userId = await authenticate(request, dependencies.tokenService);
    const { trackId } = paramsSchema.parse(request.params);
    return reply.send({ favorite: await dependencies.favorites.set(userId, trackId) });
  });

  app.delete('/favorites/tracks/:trackId', async (request, reply) => {
    const userId = await authenticate(request, dependencies.tokenService);
    const { trackId } = paramsSchema.parse(request.params);
    await dependencies.favorites.remove(userId, trackId);
    return reply.status(204).send();
  });
}
