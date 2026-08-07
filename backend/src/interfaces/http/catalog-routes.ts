import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { TokenService } from '../../application/auth-ports.js';
import type { CatalogQueryOperations } from '../../application/catalog-query.js';
import { authenticate } from './auth-routes.js';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().max(200).optional(),
});

interface CatalogRoutesDependencies {
  readonly catalog: CatalogQueryOperations;
  readonly tokenService: TokenService;
}

export async function registerCatalogRoutes(
  app: FastifyInstance,
  dependencies: CatalogRoutesDependencies,
): Promise<void> {
  app.get('/library/tracks', async (request, reply) => {
    await authenticate(request, dependencies.tokenService);
    const query = querySchema.parse(request.query);
    if (query.offset % query.limit !== 0) {
      return reply.status(400).send({
        code: 'INVALID_REQUEST',
        error: 'offset must be a multiple of limit',
        statusCode: 400,
      });
    }
    return reply.send(
      await dependencies.catalog.execute({
        page: query.offset / query.limit + 1,
        pageSize: query.limit,
        ...(query.search === undefined ? {} : { search: query.search }),
      }),
    );
  });
}
