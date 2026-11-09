import { Injectable, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import type { RealtimePayload, SessionState } from './models';

export type RealtimeEvent =
  | 'session:updated'
  | 'session:closed'
  | 'session:reopened'
  | 'participant:joined'
  | 'participant:left'
  | 'order:created'
  | 'order:updated'
  | 'order:deleted'
  | 'participation:updated';

const EVENTS: RealtimeEvent[] = [
  'session:updated',
  'session:closed',
  'session:reopened',
  'participant:joined',
  'participant:left',
  'order:created',
  'order:updated',
  'order:deleted',
  'participation:updated',
];

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export interface RealtimeHandlers {
  /** État complet reçu (événement ou resynchronisation après reconnexion). */
  onState: (state: SessionState, event: RealtimeEvent | 'resync', payload?: RealtimePayload) => void;
}

/**
 * Connexion Socket.IO unique. Le client ne fait qu'écouter : les écritures passent par l'API REST.
 * À chaque (re)connexion, on rejoint la room et on récupère l'état complet dans l'accusé de réception.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  readonly status = signal<ConnectionStatus>('connecting');
  private socket: Socket | null = null;
  private sessionId: string | null = null;
  private handlers: RealtimeHandlers | null = null;

  watch(sessionId: string, handlers: RealtimeHandlers): () => void {
    this.sessionId = sessionId;
    this.handlers = handlers;
    const socket = this.ensureSocket();
    if (socket.connected) this.joinRoom();
    return () => this.unwatch(sessionId);
  }

  private unwatch(sessionId: string): void {
    if (this.sessionId !== sessionId) return;
    this.socket?.emit('session:leave', { sessionId });
    this.sessionId = null;
    this.handlers = null;
  }

  private ensureSocket(): Socket {
    if (this.socket) return this.socket;
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });
    socket.on('connect', () => {
      this.status.set('online');
      this.joinRoom();
    });
    socket.on('disconnect', () => this.status.set('offline'));
    socket.on('connect_error', () => this.status.set('offline'));
    socket.io.on('reconnect_attempt', () => this.status.set('connecting'));

    for (const event of EVENTS) {
      socket.on(event, (payload: RealtimePayload) => {
        if (!payload?.state || payload.state.session.id !== this.sessionId) return;
        this.handlers?.onState(payload.state, event, payload);
      });
    }
    // Retour au premier plan sur mobile : on resynchronise.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && socket.connected) this.joinRoom();
      });
    }
    this.socket = socket;
    return socket;
  }

  private joinRoom(): void {
    const sessionId = this.sessionId;
    if (!sessionId || !this.socket) return;
    this.socket
      .timeout(8000)
      .emitWithAck('session:join', { sessionId })
      .then((res: { ok: boolean; state?: SessionState }) => {
        if (res.ok && res.state && this.sessionId === sessionId) this.handlers?.onState(res.state, 'resync');
      })
      .catch(() => {
        /* le serveur n'a pas répondu à temps : nouvelle tentative à la prochaine reconnexion */
      });
  }
}
