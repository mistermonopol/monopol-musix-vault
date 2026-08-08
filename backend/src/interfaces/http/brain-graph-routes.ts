import type { FastifyInstance } from 'fastify';
import type { BrainGraphOperations } from '../../application/brain-graph.js';
import type { TokenService } from '../../application/auth-ports.js';
import { authenticate } from './auth-routes.js';

export async function registerBrainGraphRoutes(app: FastifyInstance, dependencies: { readonly graph: BrainGraphOperations; readonly tokenService: TokenService }): Promise<void> {
  app.get('/brain/graph', async (request, reply) => {
    await authenticate(request, dependencies.tokenService);
    return reply.send(await dependencies.graph.get());
  });
}
