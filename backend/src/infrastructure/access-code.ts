import { createHash, timingSafeEqual } from 'node:crypto';

import type { FastifyReply, FastifyRequest } from 'fastify';

const accessCodeHeader = 'x-access-code';
const exemptMethods = new Set(['GET', 'HEAD']);
const streamPath = /^\/tracks\/[^/]+\/stream$/;

export function createAccessCodeGate(expectedAccessCode: string) {
  const expectedDigest = digest(expectedAccessCode);

  return async function requireAccessCode(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (isExempt(request)) return;

    const supplied = request.headers[accessCodeHeader];
    const suppliedDigest = digest(typeof supplied === 'string' ? supplied : '');
    if (typeof supplied === 'string' && timingSafeEqual(expectedDigest, suppliedDigest)) return;

    await reply.status(403).send({
      code: 'ACCESS_DENIED',
      error: 'Access denied',
      statusCode: 403,
    });
  };
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function isExempt(request: FastifyRequest): boolean {
  if (!exemptMethods.has(request.method)) return false;

  const path = request.url.split('?', 1)[0];
  return path === '/health' || path === '/ready' || streamPath.test(path ?? '');
}
