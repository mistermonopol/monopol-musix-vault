import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import type { TokenService } from '../../application/auth-ports.js';
import {
  TrackFileUnavailableError,
  TrackNotFoundError,
  type TrackStreamingOperations,
} from '../../application/track-streaming-service.js';
import {
  MalformedByteRangeError,
  MultipleByteRangesNotSupportedError,
  UnsatisfiableByteRangeError,
} from '../../domain/byte-range.js';
import { UnsafeTrackPathError } from '../../infrastructure/streaming/node-track-file-system.js';
import { authenticate } from './auth-routes.js';

const paramsSchema = z.object({ trackId: z.string().uuid() });

interface StreamingRoutesDependencies {
  readonly streaming: TrackStreamingOperations;
  readonly tokenService: TokenService;
}

function setFileHeaders(reply: FastifyReply, contentType: string, size: number): void {
  void reply
    .header('Accept-Ranges', 'bytes')
    .header('Cache-Control', 'private, max-age=3600')
    .header('Content-Length', size)
    .header('Content-Type', contentType)
    .header('X-Content-Type-Options', 'nosniff');
}

export async function registerStreamingRoutes(
  app: FastifyInstance,
  dependencies: StreamingRoutesDependencies,
): Promise<void> {
  app.head('/tracks/:trackId/stream', async (request, reply) => {
    await authenticate(request, dependencies.tokenService, true);
    const { trackId } = paramsSchema.parse(request.params);
    try {
      const file = await dependencies.streaming.resolve(trackId);
      setFileHeaders(reply, file.contentType, file.size);
      return reply.status(200).send();
    } catch (error: unknown) {
      return handleFileError(error, reply);
    }
  });

  app.get('/tracks/:trackId/stream', async (request, reply) => {
    await authenticate(request, dependencies.tokenService, true);
    const { trackId } = paramsSchema.parse(request.params);
    try {
      const opened = await dependencies.streaming.open(trackId, request.headers.range);
      setFileHeaders(reply, opened.contentType, opened.range?.length ?? opened.size);
      if (opened.range !== null) {
        void reply.header(
          'Content-Range',
          `bytes ${opened.range.start}-${opened.range.end}/${opened.size}`,
        );
        void reply.status(206);
      }
      request.raw.once('close', () => {
        if ('destroy' in opened.stream && typeof opened.stream.destroy === 'function') {
          opened.stream.destroy();
        }
      });
      return reply.send(opened.stream);
    } catch (error: unknown) {
      if (error instanceof UnsatisfiableByteRangeError) {
        void reply.header('Content-Range', `bytes */${error.resourceSize}`);
        return reply.status(416).send();
      }
      if (
        error instanceof MalformedByteRangeError
        || error instanceof MultipleByteRangesNotSupportedError
      ) {
        return reply.status(400).send({
          code: 'INVALID_RANGE',
          error: error.message,
          statusCode: 400,
        });
      }
      return handleFileError(error, reply);
    }
  });
}

function handleFileError(error: unknown, reply: FastifyReply): FastifyReply {
  if (
    error instanceof TrackNotFoundError
    || error instanceof TrackFileUnavailableError
    || error instanceof UnsafeTrackPathError
  ) {
    return reply.status(404).send({
      code: 'TRACK_NOT_FOUND',
      error: 'Available track not found',
      statusCode: 404,
    });
  }
  throw error;
}
