import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { z } from 'zod';
import { corsOrigins } from '../config.js';
import { prisma } from '../db.js';
import { loadPublicState } from '../services/serializer.js';
import { listLobbySessions } from '../services/lobby.service.js';
import { LOBBY_ROOM, roomOf, setIo } from './realtime.js';

const joinPayload = z.object({ sessionId: z.uuid() });

type Ack = (res: { ok: true; state: unknown } | { ok: false; error: string }) => void;

/**
 * Les clients ne peuvent qu'ÉCOUTER : toute écriture passe par l'API REST,
 * qui valide, persiste puis diffuse. Après reconnexion, le client renvoie
 * `session:join` et reçoit l'état complet à jour dans l'accusé de réception.
 */
export function attachSockets(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: '/socket.io',
    cors: corsOrigins.length ? { origin: corsOrigins } : undefined,
    serveClient: false,
    pingInterval: 20_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 10_000,
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60_000 },
  });

  io.on('connection', (socket) => {
    socket.on('session:join', async (raw: unknown, ack?: Ack) => {
      const reply: Ack = typeof ack === 'function' ? ack : () => undefined;
      const parsed = joinPayload.safeParse(raw);
      if (!parsed.success) return reply({ ok: false, error: 'Identifiant de session invalide.' });
      try {
        const exists = await prisma.session.findUnique({ where: { id: parsed.data.sessionId }, select: { id: true } });
        if (!exists) return reply({ ok: false, error: 'Session introuvable.' });
        // Un socket ne suit qu'une session à la fois.
        for (const room of socket.rooms) if (room.startsWith('session:')) await socket.leave(room);
        await socket.join(roomOf(parsed.data.sessionId));
        const state = await loadPublicState(parsed.data.sessionId);
        reply({ ok: true, state });
        socket.emit('session:joined', { sessionId: parsed.data.sessionId });
      } catch {
        reply({ ok: false, error: 'Erreur serveur.' });
      }
    });

    socket.on('session:leave', async (raw: unknown) => {
      const parsed = joinPayload.safeParse(raw);
      if (parsed.success) await socket.leave(roomOf(parsed.data.sessionId));
    });

    socket.on('lobby:join', async (_raw: unknown, ack?: (res: unknown) => void) => {
      const reply = typeof ack === 'function' ? ack : () => undefined;
      try {
        await socket.join(LOBBY_ROOM);
        reply({ ok: true, sessions: await listLobbySessions() });
      } catch {
        reply({ ok: false, error: 'Erreur serveur.' });
      }
    });

    socket.on('lobby:leave', async () => {
      await socket.leave(LOBBY_ROOM);
    });
  });

  setIo(io);
  return io;
}
