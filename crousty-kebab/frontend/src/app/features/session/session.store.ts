import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService, toApiError } from '../../core/api.service';
import { IdentityService, type SessionIdentity } from '../../core/identity.service';
import type { CroustyProduct, Order, ParticipationChoice, RealtimePayload, SessionState } from '../../core/models';
import { CROUSTY_PRODUCTS, CHOICE_LABEL, productName } from '../../core/products';
import { RealtimeService, type RealtimeEvent } from '../../core/realtime.service';
import { ToastService } from '../../core/toast.service';

export interface OrderGroup {
  name: string;
  orders: Order[];
  total: number;
}

/** Calculs purs (testés unitairement). */
export function computeCroustyStats(state: SessionState | null) {
  const orders = state?.orders ?? [];
  const byType = CROUSTY_PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    count: orders.filter((o) => o.productType === p.id).reduce((n, o) => n + o.quantity, 0),
  }));
  const total = byType.reduce((n, t) => n + t.count, 0);
  const groupsMap = new Map<string, OrderGroup>();
  for (const o of orders) {
    const key = o.targetName.toLocaleLowerCase('fr-FR');
    const g = groupsMap.get(key) ?? { name: o.targetName, orders: [], total: 0 };
    g.orders.push(o);
    g.total += o.quantity;
    groupsMap.set(key, g);
  }
  return {
    total,
    byType,
    groups: [...groupsMap.values()],
    /** Personnes ayant au moins une commande (participants ou noms ajoutés). */
    eaters: groupsMap.size,
  };
}

export function computeTacosStats(state: SessionState | null) {
  const participations = state?.participations ?? [];
  const names = new Map(state?.participants.map((p) => [p.id, p.name]) ?? []);
  const going = participations.map((p) => ({ ...p, name: names.get(p.participantId) ?? '?' }));
  const answered = new Set(participations.map((p) => p.participantId));
  return {
    going,
    total: going.length,
    tacos: going.filter((g) => g.choice === 'TACOS').length,
    kebab: going.filter((g) => g.choice === 'KEBAB').length,
    pending: (state?.participants ?? []).filter((p) => !answered.has(p.id)),
  };
}

@Injectable()
export class SessionStore {
  private readonly api = inject(ApiService);
  private readonly identityService = inject(IdentityService);
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);

  readonly state = signal<SessionState | null>(null);
  readonly identity = signal<SessionIdentity | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly busy = signal(false);
  /** Affiché à tous quand la session vient d'être clôturée. */
  readonly justClosed = signal(false);

  readonly connection = this.realtime.status;
  readonly session = computed(() => this.state()?.session ?? null);
  readonly isOpen = computed(() => this.session()?.status === 'OPEN');
  readonly isCreator = computed(() => !!this.identity()?.creatorToken);
  readonly me = computed(() => {
    const id = this.identity();
    return id ? (this.state()?.participants.find((p) => p.id === id.participantId) ?? null) : null;
  });
  readonly croustyStats = computed(() => computeCroustyStats(this.state()));
  readonly tacosStats = computed(() => computeTacosStats(this.state()));
  readonly myParticipation = computed(() => {
    const me = this.me();
    return me ? (this.state()?.participations.find((p) => p.participantId === me.id) ?? null) : null;
  });

  private stopWatching: (() => void) | null = null;
  /** Nom en cours d'inscription (évite de se notifier soi-même avant la réponse HTTP). */
  private joiningAs: string | null = null;

  async load(code: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      // 1er appel : on découvre l'id de session ; s'il est connu localement, on renvoie le jeton créateur.
      const first = await this.api.getSessionByCode(code);
      const identity = this.identityService.get(first.state.session.id);
      this.identity.set(identity);
      this.applyState(first.state, true);
      this.startRealtime(first.state.session.id);
    } catch (e) {
      const err = toApiError(e);
      this.loadError.set(err.message);
    } finally {
      this.loading.set(false);
    }
  }

  destroy(): void {
    this.stopWatching?.();
    this.stopWatching = null;
  }

  private startRealtime(sessionId: string): void {
    this.stopWatching?.();
    this.stopWatching = this.realtime.watch(sessionId, {
      onState: (state, event, payload) => this.onRealtime(state, event, payload),
    });
  }

  private onRealtime(state: SessionState, event: RealtimeEvent | 'resync', payload?: RealtimePayload): void {
    const accepted = this.applyState(state, event === 'resync');
    if (!accepted || event === 'resync') return;
    const actor = payload?.actor;
    const myName = (this.me()?.name ?? this.joiningAs ?? '').toLocaleLowerCase('fr-FR');
    const mine = !!actor && actor.toLocaleLowerCase('fr-FR') === myName;
    switch (event) {
      case 'session:closed':
        this.justClosed.set(true);
        break;
      case 'session:reopened':
        this.justClosed.set(false);
        if (!this.isCreator()) this.toast.info('La commande a été rouverte : tu peux à nouveau modifier.');
        break;
      case 'participant:joined':
        if (!mine && actor) this.toast.info(`${actor} a rejoint la session 👋`);
        break;
      case 'order:created': {
        const o = payload?.data as Order | undefined;
        if (!mine && actor && o) this.toast.info(`${actor} a ajouté ${o.quantity} × ${productName(o.productType)}`);
        break;
      }
      case 'participation:updated': {
        const p = payload?.data as { choice: ParticipationChoice } | undefined;
        if (!mine && actor && p) this.toast.info(`${actor} part sur un ${CHOICE_LABEL[p.choice]} 🌯`);
        break;
      }
      case 'participant:left': {
        const d = payload?.data as { name?: string } | undefined;
        if (!mine && d?.name) this.toast.info(`${d.name} ne vient plus`);
        break;
      }
    }
  }

  /** Applique un état uniquement s'il n'est pas plus ancien que l'état courant. */
  private applyState(state: SessionState, force = false): boolean {
    const current = this.state();
    if (!force && current && state.revision < current.revision) return false;
    this.state.set(state);
    return true;
  }

  // ---------- Identité ----------

  async join(name: string): Promise<boolean> {
    const s = this.session();
    if (!s) return false;
    this.joiningAs = name;
    return this.run(async () => {
      const res = await this.api.joinSession(s.code, name);
      const identity: SessionIdentity = {
        participantId: res.participantId,
        participantToken: res.participantToken,
        name,
      };
      this.identityService.save(s.id, identity);
      this.identityService.setName(name);
      this.identity.set(identity);
      this.applyState(res.state, true);
      this.toast.success(`Bienvenue ${name} ! 🎉`);
    });
  }

  // ---------- Commandes Crousty ----------

  addOrder(input: { targetName: string; productType: CroustyProduct; quantity: number; notes: string | null }) {
    return this.run(async () => {
      const res = await this.api.createOrder(this.session()!.id, input);
      this.applyState(res.state);
      this.toast.success(`${input.quantity} × ${productName(input.productType)} pour ${input.targetName} ✅`);
    });
  }

  updateOrder(orderId: string, input: { targetName: string; productType: CroustyProduct; quantity: number; notes: string | null }) {
    return this.run(async () => {
      const res = await this.api.updateOrder(this.session()!.id, orderId, input);
      this.applyState(res.state);
      this.toast.success('Commande modifiée ✏️');
    });
  }

  deleteOrder(orderId: string) {
    return this.run(async () => {
      const res = await this.api.deleteOrder(this.session()!.id, orderId);
      this.applyState(res.state);
      this.toast.success('Commande supprimée');
    });
  }

  canEditOrder(order: Order): boolean {
    return this.isOpen() && (this.isCreator() || order.participantId === this.identity()?.participantId);
  }

  // ---------- Tacos / Kebab ----------

  participate(choice: ParticipationChoice, notes: string | null) {
    return this.run(async () => {
      const had = !!this.myParticipation();
      const res = await this.api.upsertParticipation(this.session()!.id, { choice, notes });
      this.applyState(res.state);
      this.toast.success(had ? 'Choix mis à jour ✅' : `C'est noté : ${CHOICE_LABEL[choice]} ! 🎉`);
    });
  }

  removeParticipation(participantId: string) {
    return this.run(async () => {
      const res = await this.api.removeParticipation(this.session()!.id, participantId);
      this.applyState(res.state);
      this.toast.success(participantId === this.me()?.id ? 'Tu t’es retiré de la sortie' : 'Participant retiré');
    });
  }

  // ---------- Clôture ----------

  close() {
    return this.run(async () => {
      const res = await this.api.closeSession(this.session()!.id);
      this.applyState(res.state);
      this.justClosed.set(true);
    });
  }

  reopen() {
    return this.run(async () => {
      const res = await this.api.reopenSession(this.session()!.id);
      this.applyState(res.state);
      this.justClosed.set(false);
      this.toast.success('Commande rouverte 🔓');
    });
  }

  private async run(fn: () => Promise<void>): Promise<boolean> {
    this.busy.set(true);
    try {
      await fn();
      return true;
    } catch (e) {
      const err = toApiError(e);
      this.toast.error(err.message);
      // Si la session a été fermée entre-temps, on se resynchronise.
      if (err.code === 'SESSION_CLOSED' && this.session()) {
        try {
          const fresh = await this.api.getSessionByCode(this.session()!.code, this.session()!.id);
          this.applyState(fresh.state, true);
        } catch {
          /* ignore */
        }
      }
      return false;
    } finally {
      this.busy.set(false);
    }
  }
}
