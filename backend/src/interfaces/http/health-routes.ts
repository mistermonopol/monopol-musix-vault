import type { FastifyInstance } from 'fastify';

import type { GetHealth } from '../../application/get-health.js';

interface HealthRoutesDependencies {
  readonly getHealth: GetHealth;
}

export async function registerHealthRoutes(
  app: FastifyInstance,
  dependencies: HealthRoutesDependencies,
): Promise<void> {
  app.get('/health', async (_request, reply) => {
    return reply.send(dependencies.getHealth.execute('ok'));
  });

  app.get('/ready', async (_request, reply) => {
    return reply.send(dependencies.getHealth.execute('ready'));
  });
}
