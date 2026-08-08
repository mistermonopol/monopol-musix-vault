import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { DeviceOperations, ListeningOperations, PlaylistOperations, QueueOperations } from '../../application/user-data.js';
import type { TokenService } from '../../application/auth-ports.js';
import { authenticate } from './auth-routes.js';

const uuid = z.string().uuid();
const idParams = z.object({ id: uuid });
const trackParams = z.object({ trackId: uuid });
const deviceParams = z.object({ deviceId: uuid });
const playlistBody = z.object({ description: z.string().max(2000).default(''), name: z.string().trim().min(1).max(200) });
const queueBody = z.object({ currentIndex: z.number().int().nonnegative().nullable().default(null), items: z.array(uuid).max(500), positionSeconds: z.number().nonnegative().default(0) }).refine((x) => x.currentIndex === null || x.currentIndex < x.items.length, { message: 'currentIndex must reference an item' });

export interface UserDataRoutesDependencies { readonly devices: DeviceOperations; readonly listening: ListeningOperations; readonly playlists: PlaylistOperations; readonly queues: QueueOperations; readonly tokenService: TokenService }
export async function registerUserDataRoutes(app: FastifyInstance, d: UserDataRoutesDependencies): Promise<void> {
  app.get('/listening/recent', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(25) }).parse(request.query); return reply.send({ items: await d.listening.listRecent(userId, limit) }); });
  app.post('/listening/events', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const body = z.object({ eventType: z.enum(['started', 'progress', 'paused', 'completed']), occurredAt: z.coerce.date().optional(), positionSeconds: z.number().nonnegative().optional(), trackId: uuid }).parse(request.body); try { return reply.status(201).send({ event: await d.listening.addEvent(userId, body) }); } catch (error) { return missingTrack(error, reply); } });
  app.get('/listening/positions/:trackId', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const { trackId } = trackParams.parse(request.params); const value = await d.listening.getPosition(userId, trackId); return value === null ? reply.status(404).send(notFound('POSITION_NOT_FOUND')) : reply.send({ position: value }); });
  app.put('/listening/positions/:trackId', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const { trackId } = trackParams.parse(request.params); const { positionSeconds } = z.object({ positionSeconds: z.number().nonnegative() }).parse(request.body); const value = await d.listening.upsertPosition(userId, trackId, positionSeconds); return value === null ? reply.status(404).send(notFound('TRACK_NOT_FOUND')) : reply.send({ position: value }); });

  app.get('/playlists', async (request, reply) => reply.send({ items: await d.playlists.list(await authenticate(request, d.tokenService)) }));
  app.post('/playlists', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const body = playlistBody.parse(request.body); return reply.status(201).send({ playlist: await d.playlists.create(userId, body.name, body.description) }); });
  app.get('/playlists/:id', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const { id } = idParams.parse(request.params); const value = await d.playlists.get(userId, id); return value === null ? reply.status(404).send(notFound('PLAYLIST_NOT_FOUND')) : reply.send({ playlist: value }); });
  app.patch('/playlists/:id', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const { id } = idParams.parse(request.params); const body = playlistBody.parse(request.body); const value = await d.playlists.update(userId, id, body.name, body.description); return value === null ? reply.status(404).send(notFound('PLAYLIST_NOT_FOUND')) : reply.send({ playlist: value }); });
  app.put('/playlists/:id/items', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const { id } = idParams.parse(request.params); const { trackIds } = z.object({ trackIds: z.array(uuid).max(1000) }).parse(request.body); try { const value = await d.playlists.replaceItems(userId, id, trackIds); return value === null ? reply.status(404).send(notFound('PLAYLIST_NOT_FOUND')) : reply.send({ playlist: value }); } catch (error) { return missingTrack(error, reply); } });
  app.delete('/playlists/:id', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const { id } = idParams.parse(request.params); return await d.playlists.delete(userId, id) ? reply.status(204).send() : reply.status(404).send(notFound('PLAYLIST_NOT_FOUND')); });

  app.get('/devices', async (request, reply) => reply.send({ items: await d.devices.list(await authenticate(request, d.tokenService)) }));
  app.post('/devices', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const body = z.object({ kind: z.string().trim().min(1).max(50).default('unknown'), name: z.string().trim().min(1).max(200) }).parse(request.body); return reply.status(201).send({ device: await d.devices.register(userId, body.name, body.kind) }); });
  app.delete('/devices/:id', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const { id } = idParams.parse(request.params); return await d.devices.revoke(userId, id) ? reply.status(204).send() : reply.status(404).send(notFound('DEVICE_NOT_FOUND')); });

  app.get('/queue/:deviceId', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const { deviceId } = deviceParams.parse(request.params); const value = await d.queues.get(userId, deviceId); return value === null ? reply.status(404).send(notFound('QUEUE_NOT_FOUND')) : reply.send({ queue: value }); });
  app.put('/queue/:deviceId', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const { deviceId } = deviceParams.parse(request.params); const body = queueBody.parse(request.body); try { const value = await d.queues.save(userId, { ...body, deviceId }); return value === null ? reply.status(404).send(notFound('DEVICE_NOT_FOUND')) : reply.send({ queue: value }); } catch (error) { return missingTrack(error, reply); } });
  app.post('/queue/transfer', async (request, reply) => { const userId = await authenticate(request, d.tokenService); const body = z.object({ sourceDeviceId: uuid, targetDeviceId: uuid }).parse(request.body); const value = await d.queues.transfer(userId, body.sourceDeviceId, body.targetDeviceId); return value === null ? reply.status(404).send(notFound('QUEUE_OR_DEVICE_NOT_FOUND')) : reply.send({ autoPlay: false, queue: value }); });
}

function notFound(code: string) { return { code, error: 'Resource not found', statusCode: 404 }; }
function missingTrack(error: unknown, reply: FastifyReply) { if (error instanceof Error && error.message === 'TRACK_NOT_FOUND') return reply.status(404).send(notFound('TRACK_NOT_FOUND')); throw error; }
