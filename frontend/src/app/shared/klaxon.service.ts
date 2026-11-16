import { Injectable, inject, signal } from '@angular/core';
import { RealtimeService, type KlaxonDir } from '../core/realtime.service';
import { ToastService } from '../core/toast.service';

/** Doivent rester alignés sur KLAXON_COOLDOWN_MS / KLAXON_FLIP_COOLDOWN_MS côté backend. */
const COOLDOWN_MS = 600;
const FLIP_COOLDOWN_MS = 150;

const DIRS: KlaxonDir[] = ['haut', 'bas'];
const urlOf = (dir: KlaxonDir) => `sounds/klaxon_${dir}.mp3`;

/**
 * Easter egg de l'accueil : le levier fait klaxonner tout le monde, y compris les visiteurs
 * qui n'ont pas débloqué le levier. Le son est joué localement tout de suite, puis relayé.
 *
 * Les navigateurs (iOS en tête) refusent de jouer un son reçu « de nulle part » : on débloque
 * donc un AudioContext à la toute première interaction avec la page, quelle qu'elle soit.
 */
@Injectable({ providedIn: 'root' })
export class KlaxonService {
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private ctx: AudioContext | null = null;
  private readonly buffers = new Map<KlaxonDir, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private lastHonk: { dir: KlaxonDir; at: number } | null = null;
  private lastHint = 0;
  /** Incrémenté à chaque klaxon (local ou distant), pour animer le levier. */
  readonly honks = signal(0);

  constructor() {
    this.realtime.onKlaxon((dir) => this.play(dir, true));
    if (typeof document === 'undefined') return;
    // Écouteurs laissés en place : iOS peut re-suspendre le contexte (appel, verrouillage…).
    for (const type of ['pointerdown', 'keydown', 'touchend']) {
      document.addEventListener(type, () => this.unlock(), { capture: true, passive: true });
    }
  }

  honk(dir: KlaxonDir): void {
    const now = Date.now();
    const wait = this.lastHonk?.dir === dir ? COOLDOWN_MS : FLIP_COOLDOWN_MS;
    if (this.lastHonk && now - this.lastHonk.at < wait) return;
    this.lastHonk = { dir, at: now };
    this.play(dir, false);
    this.realtime.sendKlaxon(dir);
  }

  private unlock(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.ctx ??= new Ctor();
    } catch {
      return;
    }
    if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined);
    this.loading ??= this.load(this.ctx);
  }

  private async load(ctx: AudioContext): Promise<void> {
    await Promise.all(
      DIRS.map(async (dir) => {
        try {
          const data = await (await fetch(urlOf(dir))).arrayBuffer();
          this.buffers.set(dir, await ctx.decodeAudioData(data));
        } catch {
          /* repli sur <audio> au moment de jouer */
        }
      }),
    );
  }

  private play(dir: KlaxonDir, remote: boolean): void {
    this.honks.update((n) => n + 1);
    const buffer = this.buffers.get(dir);
    if (this.ctx?.state === 'running' && buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start();
      return;
    }
    // Son pas encore prêt : on tente un <audio> classique.
    new Audio(urlOf(dir)).play().catch(() => {
      // La personne n'a pas encore touché la page : le navigateur bloque tout son.
      if (!remote || Date.now() - this.lastHint < 5000) return;
      this.lastHint = Date.now();
      this.toast.info('📯 Quelqu’un a tiré le levier ! Touche la page pour entendre le klaxon');
    });
  }
}
