import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
  LogController,
} from 'fastify';

import { GetHealth } from './application/get-health.js';
import type { AppConfig } from './infrastructure/config.js';
import { SystemClock } from './infrastructure/system-clock.js';
import { registerHealthRoutes } from './interfaces/http/health-routes.js';

export interface BuildAppOptions {
  readonly config: AppConfig;
  readonly logger?: FastifyServerOptions['logger'];
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
          }),
  });

  app.setErrorHandler((error, request, reply) => {
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

  const getHealth = new GetHealth(new SystemClock(), '0.1.0');
  await app.register(registerHealthRoutes, { getHealth });

  return app;
}
