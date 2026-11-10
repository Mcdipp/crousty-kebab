import { Injectable, signal } from '@angular/core';
import { io, type Socket } from 'socket.io-client';
import type { RealtimePayload, SessionState, SessionSummary } from './models';

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

export interface LobbyHandlers {
  /** Liste complète (à la connexion / reconnexion). */
  onList: (sessions: SessionSummary[]) => void;
  /** Une session créée ou modifiée. */
  onSession: (session: SessionSummary) => void;
}

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
  private lobby: LobbyHandlers | null = null;

  watchLobby(handlers: LobbyHandlers): () => void {
    this.lobby = handlers;
    const socket = this.ensureSocket();
    if (socket.connected) this.joinLobby();
    return () => {
      if (this.lobby !== handlers) return;
      this.lobby = null;
      this.socket?.emit('lobby:leave');
    };
  }

  private joinLobby(): void {
    if (!this.lobby || !this.socket) return;
    this.socket
      .timeout(8000)
      .emitWithAck('lobby:join', {})
      .then((res: { ok: boolean; sessions?: SessionSummary[] }) => {
        if (res.ok && res.sessions) this.lobby?.onList(res.sessions);
      })
      .catch(() => {
        /* nouvelle tentative à la prochaine reconnexion */
      });
  }

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
      this.joinLobby();
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
    socket.on('lobby:session', (summary: SessionSummary) => {
      if (summary?.id) this.lobby?.onSession(summary);
    });
    // Retour au premier plan sur mobile : on resynchronise.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && socket.connected)
          this.joinRoom();
          this.joinLobby()
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
