import type { Server } from 'socket.io';
import { summarize } from '../services/lobby.service.js';
import type { PublicSessionState } from '../services/serializer.js';

/** Événements diffusés aux participants d'une session. */
export type ServerEvent =
  | 'session:updated'
  | 'session:closed'
  | 'session:reopened'
  | 'participant:joined'
  | 'participant:left'
  | 'order:created'
  | 'order:updated'
  | 'order:deleted'
  | 'participation:updated';

export interface EventPayload {
  /** État public complet de la session après l'opération (source de vérité). */
  state: PublicSessionState;
  /** Nom de la personne à l'origine de l'action (pour les notifications). */
  actor: string | null;
  /** Détail de l'entité concernée. */
  data?: unknown;
}

let io: Server | null = null;

export function setIo(server: Server | null): void {
  io = server;
}

export const roomOf = (sessionId: string) => `session:${sessionId}`;
/** Room des clients présents sur l'accueil (liste des sessions en direct). */
export const LOBBY_ROOM = 'lobby';

/**
 * Diffuse un événement à tous les clients de la room.
 * Toujours appelé APRÈS la validation et la persistance en base.
 */
export function broadcast(sessionId: string, event: ServerEvent, payload: EventPayload): void {
  io?.to(roomOf(sessionId)).emit(event, payload);
  broadcastLobby(payload.state);
}

/** Met à jour la carte de la session sur l'accueil de tout le monde. */
export function broadcastLobby(state: PublicSessionState): void {
  io?.to(LOBBY_ROOM).emit('lobby:session', summarize(state));
}
