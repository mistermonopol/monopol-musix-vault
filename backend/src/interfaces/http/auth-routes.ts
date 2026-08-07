import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { invalidToken } from '../../application/auth-errors.js';
import type { AuthRepository, TokenService } from '../../application/auth-ports.js';
import type { AuthOperations, AuthResult } from '../../application/auth-service.js';

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

export async function authenticate(
  request: FastifyRequest,
  tokenService: TokenService,
  allowStreamCookie = false,
): Promise<string> {
  const authorization = request.headers.authorization;
  const bearerToken = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : undefined;
  const token = bearerToken ?? (allowStreamCookie
    ? readCookie(request.headers.cookie, 'mmv_stream')
    : undefined);
  if (token === undefined) throw invalidToken();
  try {
    const claims = await tokenService.verifyAccessToken(token);
    return claims.userId;
  } catch {
    throw invalidToken();
  }
}

function sendAuthenticated(reply: FastifyReply, result: AuthResult): FastifyReply {
  void reply.header(
    'Set-Cookie',
    `mmv_stream=${result.accessToken}; Path=/api/tracks/; HttpOnly; Secure; SameSite=Strict`,
  );
  return reply.send(result);
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (header === undefined) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim() || undefined;
    }
  }
  return undefined;
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
      const result = await dependencies.authService.bootstrap(body.email, body.password);
      void reply.status(201);
      return sendAuthenticated(reply, result);
    },
  );

  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = credentialsSchema.parse(request.body);
      return sendAuthenticated(
        reply,
        await dependencies.authService.login(body.email, body.password),
      );
    },
  );

  app.post('/auth/refresh', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    return sendAuthenticated(
      reply,
      await dependencies.authService.refresh(body.refreshToken),
    );
  });

  app.post('/auth/logout', async (request, reply) => {
    const body = refreshSchema.parse(request.body);
    await dependencies.authService.logout(body.refreshToken);
    void reply.header(
      'Set-Cookie',
      'mmv_stream=; Path=/api/tracks/; HttpOnly; Secure; SameSite=Strict; Max-Age=0',
    );
    return reply.status(204).send();
  });

  app.get('/auth/me', async (request, reply) => {
    const userId = await authenticate(request, dependencies.tokenService);
    const user = await dependencies.authRepository.findUserById(userId);
    if (user === null) throw invalidToken();
    return reply.send({ user });
  });
}
