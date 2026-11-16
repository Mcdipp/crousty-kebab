import { Injectable, inject, signal } from '@angular/core';
import { RealtimeService, type KlaxonDir } from '../core/realtime.service';
import { ToastService } from '../core/toast.service';

/** Doivent rester alignés sur KLAXON_COOLDOWN_MS / KLAXON_FLIP_COOLDOWN_MS côté backend. */
const COOLDOWN_MS = 600;
const FLIP_COOLDOWN_MS = 150;

/**
 * Easter egg de l'accueil : le levier fait klaxonner tout le monde.
 * Le son est joué localement tout de suite, puis relayé aux autres visiteurs de l'accueil.
 */
@Injectable({ providedIn: 'root' })
export class KlaxonService {
  private readonly realtime = inject(RealtimeService);
  private readonly toast = inject(ToastService);
  private readonly sounds = new Map<KlaxonDir, HTMLAudioElement>();
  private lastHonk: { dir: KlaxonDir; at: number } | null = null;
  /** Incrémenté à chaque klaxon (local ou distant), pour animer le levier. */
  readonly honks = signal(0);

  constructor() {
    this.realtime.onKlaxon((dir) => this.play(dir, true));
  }

  honk(dir: KlaxonDir): void {
    const now = Date.now();
    const wait = this.lastHonk?.dir === dir ? COOLDOWN_MS : FLIP_COOLDOWN_MS;
    if (this.lastHonk && now - this.lastHonk.at < wait) return;
    this.lastHonk = { dir, at: now };
    this.play(dir, false);
    this.realtime.sendKlaxon(dir);
  }

  private play(dir: KlaxonDir, remote: boolean): void {
    this.honks.update((n) => n + 1);
    const audio = this.sound(dir);
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Le navigateur bloque le son tant que la personne n'a pas interagi avec la page.
      if (remote) this.toast.info('📯 Tuuut tuuut ! Quelqu’un a tiré le levier');
    });
  }

  private sound(dir: KlaxonDir): HTMLAudioElement {
    let audio = this.sounds.get(dir);
    if (!audio) {
      audio = new Audio(`sounds/klaxon_${dir}.mp3`);
      audio.preload = 'auto';
      this.sounds.set(dir, audio);
    }
    return audio;
  }
}
