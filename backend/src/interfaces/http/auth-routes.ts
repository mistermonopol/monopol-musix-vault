import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { invalidToken } from '../../application/auth-errors.js';
import type { AuthRepository, TokenService } from '../../application/auth-ports.js';
import type { AuthOperations } from '../../application/auth-service.js';

const credentialsSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});
const refreshSchema = z.object({ refreshToken: z.string().min(32).max(256) });

export interface AuthRoutesDependencies {
  readonly authRepository: AuthRepository;
  readonly authService: AuthOperations;
  readonly tokenService: TokenService;
}

async function authenticate(
  request: FastifyRequest,
  tokenService: TokenService,
): Promise<string> {
  const authorization = request.headers.authorization;
  if (authorization === undefined || !authorization.startsWith('Bearer ')) {
    throw invalidToken();
  }
  try {
    const claims = await tokenService.verifyAccessToken(authorization.slice(7));
    return claims.userId;
  } catch {
    throw invalidToken();
  }
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  dependencies: AuthRoutesDependencies,
): Promise<void> {
  app.post(
    '/auth/bootstrap',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = credentialsSchema.parse(request.body);
      return reply.status(201).send(
        await dependencies.authService.bootstrap(body.email, body.password),
      );
    },
  );

  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = credentialsSchema.parse(request.body);
      return reply.send(await dependencies.authService.login(body.email, body.password));
    },
  );

  app.post('/auth/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    return reply.send(await dependencies.authService.refresh(body.refreshToken));
  });

  app.post('/auth/logout', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    await dependencies.authService.logout(body.refreshToken);
    return reply.status(204).send();
  });

  app.get('/auth/me', async (request, reply) => {
    const userId = await authenticate(request, dependencies.tokenService);
    const user = await dependencies.authRepository.findUserById(userId);
    if (user === null) throw invalidToken();
    return reply.send({ user });
  });
}
