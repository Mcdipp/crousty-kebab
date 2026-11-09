import { Injectable, signal } from '@angular/core';

export interface SessionIdentity {
  participantId: string;
  participantToken: string;
  name: string;
  /** Jeton secret de gestion — uniquement pour le créateur de la session. */
  creatorToken?: string;
}

const NAME_KEY = 'ck:name';
const SESSION_PREFIX = 'ck:session:';

/**
 * Stockage local (navigateur) : pseudo mémorisé et jetons par session.
 * Toutes les lectures/écritures sont protégées (navigation privée, stockage bloqué…).
 */
@Injectable({ providedIn: 'root' })
export class IdentityService {
  private readonly memory = new Map<string, string>();
  readonly name = signal<string>(this.read(NAME_KEY) ?? '');

  setName(name: string): void {
    const clean = name.trim();
    this.name.set(clean);
    this.write(NAME_KEY, clean);
  }

  get(sessionId: string): SessionIdentity | null {
    const raw = this.read(SESSION_PREFIX + sessionId);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SessionIdentity;
      return parsed && typeof parsed.participantToken === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  save(sessionId: string, identity: SessionIdentity): void {
    this.write(SESSION_PREFIX + sessionId, JSON.stringify(identity));
  }

  forget(sessionId: string): void {
    this.memory.delete(SESSION_PREFIX + sessionId);
    try {
      localStorage.removeItem(SESSION_PREFIX + sessionId);
    } catch {
      /* stockage indisponible */
    }
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key) ?? this.memory.get(key) ?? null;
    } catch {
      return this.memory.get(key) ?? null;
    }
  }

  private write(key: string, value: string): void {
    this.memory.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch {
      /* stockage indisponible : on garde la valeur en mémoire */
    }
  }
}
