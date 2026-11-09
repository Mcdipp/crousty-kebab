import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  ApiErrorBody,
  CreateSessionResponse,
  CroustyProduct,
  FoodChoice,
  JoinSessionResponse,
  Order,
  Participation,
  ParticipationChoice,
  SessionState,
  SessionType,
} from './models';
import { IdentityService } from './identity.service';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return new ApiError(0, 'NETWORK', 'Pas de connexion au serveur. Vérifie ta connexion Internet.');
    }
    const body = err.error as Partial<ApiErrorBody> | null;
    return new ApiError(err.status, body?.error?.code ?? 'HTTP_ERROR', body?.error?.message ?? 'Une erreur est survenue.');
  }
  return new ApiError(-1, 'UNKNOWN', 'Une erreur inattendue est survenue.');
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly identity = inject(IdentityService);

  private headersFor(sessionId?: string): HttpHeaders {
    let h = new HttpHeaders();
    if (!sessionId) return h;
    const id = this.identity.get(sessionId);
    if (id?.participantToken) h = h.set('X-Participant-Token', id.participantToken);
    if (id?.creatorToken) h = h.set('X-Creator-Token', id.creatorToken);
    return h;
  }

  private async call<T>(p: Promise<T>): Promise<T> {
    try {
      return await p;
    } catch (e) {
      throw toApiError(e);
    }
  }

  getConfig() {
    return this.call(firstValueFrom(this.http.get<{ croustyPhone: string }>('/api/config')));
  }

  createSession(body: {
    type: SessionType;
    creatorName: string;
    scheduledAt: string;
    description?: string;
    foodChoice?: FoodChoice;
  }) {
    return this.call(firstValueFrom(this.http.post<CreateSessionResponse>('/api/sessions', body)));
  }

  /** `knownSessionId` permet d'envoyer le jeton de gestion pour savoir si on est le créateur. */
  getSessionByCode(code: string, knownSessionId?: string) {
    return this.call(
      firstValueFrom(
        this.http.get<{ state: SessionState; isCreator: boolean }>(`/api/sessions/${encodeURIComponent(code)}`, {
          headers: this.headersFor(knownSessionId),
        }),
      ),
    );
  }

  joinSession(code: string, name: string, participantToken?: string) {
    return this.call(
      firstValueFrom(this.http.post<JoinSessionResponse>('/api/sessions/join', { code, name, participantToken })),
    );
  }

  createOrder(
    sessionId: string,
    body: { targetName: string; productType: CroustyProduct; quantity: number; notes?: string | null },
  ) {
    return this.call(
      firstValueFrom(
        this.http.post<{ order: Order; state: SessionState }>(`/api/sessions/${sessionId}/orders`, body, {
          headers: this.headersFor(sessionId),
        }),
      ),
    );
  }

  updateOrder(
    sessionId: string,
    orderId: string,
    body: Partial<{ targetName: string; productType: CroustyProduct; quantity: number; notes: string | null }>,
  ) {
    return this.call(
      firstValueFrom(
        this.http.patch<{ order: Order; state: SessionState }>(`/api/orders/${orderId}`, body, {
          headers: this.headersFor(sessionId),
        }),
      ),
    );
  }

  deleteOrder(sessionId: string, orderId: string) {
    return this.call(
      firstValueFrom(
        this.http.delete<{ state: SessionState }>(`/api/orders/${orderId}`, { headers: this.headersFor(sessionId) }),
      ),
    );
  }

  closeSession(sessionId: string) {
    return this.call(
      firstValueFrom(
        this.http.post<{ state: SessionState }>(`/api/sessions/${sessionId}/close`, {}, { headers: this.headersFor(sessionId) }),
      ),
    );
  }

  reopenSession(sessionId: string) {
    return this.call(
      firstValueFrom(
        this.http.post<{ state: SessionState }>(`/api/sessions/${sessionId}/reopen`, {}, { headers: this.headersFor(sessionId) }),
      ),
    );
  }

  upsertParticipation(sessionId: string, body: { choice: ParticipationChoice; notes?: string | null }) {
    return this.call(
      firstValueFrom(
        this.http.post<{ participation: Participation; state: SessionState }>(
          `/api/sessions/${sessionId}/participations`,
          body,
          { headers: this.headersFor(sessionId) },
        ),
      ),
    );
  }

  removeParticipation(sessionId: string, participantId: string) {
    return this.call(
      firstValueFrom(
        this.http.delete<{ state: SessionState }>(`/api/sessions/${sessionId}/participations/${participantId}`, {
          headers: this.headersFor(sessionId),
        }),
      ),
    );
  }
}
