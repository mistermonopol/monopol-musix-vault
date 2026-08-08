import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { ArtworkLookupDisabledError, ArtworkLookupInProgressError, type ArtworkLookupOperations } from '../../application/artwork-lookup.js';
import type { TokenService } from '../../application/auth-ports.js';
import { authenticateClaims } from './auth-routes.js';

interface Dependencies { readonly artworkLookup: ArtworkLookupOperations; readonly tokenService: TokenService }
const startSchema = z.object({ retry: z.boolean().default(false) }).default({ retry: false });

export async function registerAdminArtworkRoutes(app: FastifyInstance, dependencies: Dependencies): Promise<void> {
  app.get('/admin/artwork/lookup', async (request, reply) => {
    if (!await requireAdmin(request, dependencies.tokenService)) return reply.status(403).send(adminRequired());
    return reply.send(dependencies.artworkLookup.status());
  });
  app.post('/admin/artwork/lookup', async (request, reply) => {
    if (!await requireAdmin(request, dependencies.tokenService)) return reply.status(403).send(adminRequired());
    try {
      const body = startSchema.parse(request.body ?? {});
      return reply.status(202).send(dependencies.artworkLookup.start(body));
    } catch (error: unknown) {
      if (error instanceof ArtworkLookupDisabledError) return reply.status(503).send({ code: 'ARTWORK_LOOKUP_DISABLED', error: error.message, statusCode: 503 });
      if (error instanceof ArtworkLookupInProgressError) return reply.status(409).send({ code: 'ARTWORK_LOOKUP_IN_PROGRESS', error: error.message, statusCode: 409 });
      throw error;
    }
  });
}

async function requireAdmin(request: FastifyRequest, tokenService: TokenService): Promise<boolean> {
  return (await authenticateClaims(request, tokenService)).role === 'admin';
}
function adminRequired(): object { return { code: 'ADMIN_REQUIRED', error: 'Administrator access required', statusCode: 403 }; }
