import type { FastifyInstance } from 'fastify';

import type { DatabaseHealth } from '../../application/database-health.js';
import type { GetHealth } from '../../application/get-health.js';

interface HealthRoutesDependencies {
  readonly databaseHealth: DatabaseHealth;
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
    if (!(await dependencies.databaseHealth.isReady())) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        statusCode: 503,
      });
    }

    return reply.send(dependencies.getHealth.execute('ready'));
  });
}
