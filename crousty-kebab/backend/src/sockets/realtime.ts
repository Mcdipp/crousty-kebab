import type { Server } from 'socket.io';
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

/**
 * Diffuse un événement à tous les clients de la room.
 * Toujours appelé APRÈS la validation et la persistance en base.
 */
export function broadcast(sessionId: string, event: ServerEvent, payload: EventPayload): void {
  io?.to(roomOf(sessionId)).emit(event, payload);
}
