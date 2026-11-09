import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { IdentityService } from '../../core/identity.service';
import type { SessionSummary } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { formatHour } from '../../core/time';
import { IconComponent } from '../../shared/icon.component';
import { sortSessions, upsertSession } from './lobby';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly identity = inject(IdentityService);
  private readonly realtime = inject(RealtimeService);

  readonly name = signal(this.identity.name());
  readonly code = signal('');
  readonly nameError = signal<string | null>(null);
  readonly joinError = signal<string | null>(null);
  readonly joining = signal(false);

  private readonly rawSessions = signal<SessionSummary[]>([]);
  readonly sessions = computed(() => sortSessions(this.rawSessions()));
  readonly openCount = computed(() => this.sessions().filter((s)=> s.status === 'OPEN').length);
  readonly sessionsLoading = signal(true);
  readonly sessionsError = signal<string | null>(null);
  readonly connection = this.realtime.status;
  protected readonly formatHour = formatHour;

  constructor() {
    // 1) Chargement HTTP immédiat (fonctionne même si le WebSocket tarde)
    this.api
      .listSessions()
      .then((r) => {
        // Si le socket a déjà livré une liste, on fusionne sans écraser des versions plus récentes.
        this.rawSessions.update((cur) => r.sessions.reduce(upsertSession, cur));
        this.sessionsError.set(null);
      })
      .catch((e: Error) => this.sessionsError.set(e.message))
      .finally(() => this.sessionsLoading.set(false));

    // 2) Mises à jour en temps réel
    const stop = this.realtime.watchLobby({
      onList: (list) => {
        this.rawSessions.set(list);
        this.sessionsLoading.set(false);
        this.sessionsError.set(null);
      },
      onSession: (s) => this.rawSessions.update((cur) => upsertSession(cur, s)),
    });
    inject(DestroyRef).onDestroy(stop);
  }

  isMember(s: SessionSummary): boolean {
    return !!this.identity.get(s.id);
  }

  isMine(s: SessionSummary): boolean {
    return !!this.identity.get(s.id)?.creatorToken;
  }

  private validName(): string | null {
    const n = this.name().trim().replace(/\s+/g, ' ');
    if (!n) {
      this.nameError.set('Dis-nous d’abord comment tu t’appelles !');
      document.getElementById('name')?.focus();
      window.scrollTo?.({top: 0, behavior: 'smooth'})
      return null;
    }
    if (n.length > 30) {
      this.nameError.set('30 caractères maximum.');
      return null;
    }
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _'.-]*$/u.test(n)) {
      this.nameError.set('Lettres, chiffres, espaces et - \' _ . uniquement.');
      return null;
    }
    this.nameError.set(null);
    this.identity.setName(n);
    return n;
  }

  onNameInput(v: string): void {
    this.name.set(v);
    if (this.nameError()) this.nameError.set(null);
  }

  onCodeInput(v: string): void {
    this.code.set(v.replace(/\D/g, '').slice(0, 4));
    this.joinError.set(null);
  }

  create(type: 'crousty' | 'tacos-kebab'): void {
    if (!this.validName()) return;
    void this.router.navigate(['/creer', type]);
  }

  openSession(s: SessionSummary): void{
    if (this.isMember(s) || s.status === 'CLOSED') {
      void this.router.navigate(['/session', s.code]);
      return;
    }
    if (!this.validName()) return;
    void this.router.navigate(['/session', s.code], {queryParams: { rejoindre: 1} });
  }

  async join(): Promise<void> {
    const name = this.validName();
    if (!name) return;
    const code = this.code();
    if (!/^\d{4}$/.test(code)) {
      this.joinError.set('Le code contient 4 chiffres.');
      return;
    }
    this.joining.set(true);
    try {
      // Vérifie l'existence avant de naviguer, pour un message d'erreur immédiat.
      const { state } = await this.api.getSessionByCode(code);
      const known = this.identity.get(state.session.id);
      if (!known && state.session.status === 'CLOSED') {
        this.joinError.set('Cette session est clôturée : la commande a déjà été passée.');
        return;
      }
      await this.router.navigate(['/session', code], { queryParams: known ? {} : { rejoindre: 1 } });
    } catch (e) {
      this.joinError.set((e as Error).message);
    } finally {
      this.joining.set(false);
    }
  }
}
