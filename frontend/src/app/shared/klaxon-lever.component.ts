import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, untracked, viewChild } from '@angular/core';
import type { KlaxonDir } from '../core/realtime.service';
import { KlaxonService } from './klaxon.service';

/** Débattement maximal du levier, en degrés. */
const MAX_ANGLE = 35;
/** Angle à dépasser pour déclencher le klaxon. */
const TRIGGER_ANGLE = 24;
/** En dessous de cet angle, le levier est réarmé. */
const REARM_ANGLE = 10;

/** Levier façon sifflet de locomotive : vers le haut ou vers le bas, ça klaxonne chez tout le monde. */
@Component({
  selector: 'app-klaxon-lever',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #plate
      class="lever"
      [class.lever--dragging]="dragging()"
      [class.lever--honk]="honking()"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="release()"
      (pointercancel)="release()"
    >
      <span class="lever__mark lever__mark--up" aria-hidden="true">▲</span>
      <span class="lever__mark lever__mark--down" aria-hidden="true">▼</span>
      <span class="lever__slot" aria-hidden="true"></span>
      <div class="lever__arm" [style.transform]="'rotate(' + angle() + 'deg)'">
        <button
          type="button"
          class="lever__knob"
          aria-label="Levier du klaxon : flèche haut ou flèche bas pour klaxonner"
          (keydown)="onKey($event)"
        ></button>
      </div>
      <span class="lever__pivot" aria-hidden="true"></span>
      @if (honking()) {
        <span class="lever__tuut" aria-hidden="true">TUUUT !</span>
      }
    </div>
  `,
  styles: `
    :host { display: flex; justify-content: center; padding: 12px 0 4px; }
    .lever {
      --pivot-x: 44px;
      position: relative; width: 240px; height: 150px;
      border-radius: 18px;
      background: radial-gradient(120% 120% at 20% 10%, #3a2f27, var(--ink));
      box-shadow: inset 0 2px 0 rgb(255 255 255 / .06), var(--shadow-lg);
      touch-action: none; user-select: none; -webkit-user-select: none;
      cursor: grab;
    }
    .lever--dragging { cursor: grabbing; }
    .lever__slot {
      position: absolute; left: var(--pivot-x); top: 50%; width: 180px; height: 180px;
      transform: translate(-50%, -50%); border-radius: 50%;
      /* Secteur balayé par le levier (±35° autour de l'horizontale). */
      background: conic-gradient(from 55deg, rgb(242 107 29 / .18) 0 70deg, transparent 70deg);
      clip-path: inset(0 0 0 50%);
    }
    .lever__mark { position: absolute; right: 16px; color: var(--orange); font-size: .8rem; opacity: .8; }
    .lever__mark--up { top: 14px; }
    .lever__mark--down { bottom: 14px; }
    .lever__arm {
      position: absolute; left: var(--pivot-x); top: calc(50% - 7px);
      width: 150px; height: 14px; border-radius: 7px;
      transform-origin: 0 50%;
      background: linear-gradient(180deg, #e7c46a, #a37a22 70%, #6e5114);
      box-shadow: 0 3px 6px rgb(0 0 0 / .4);
      transition: transform .35s cubic-bezier(.34, 1.56, .64, 1);
    }
    .lever--dragging .lever__arm { transition: none; }
    .lever__knob {
      position: absolute; right: -22px; top: 50%; width: 44px; height: 44px;
      transform: translateY(-50%); border-radius: 50%; border: 0; padding: 0;
      background: radial-gradient(circle at 35% 30%, #ffb07a, var(--orange) 45%, var(--orange-600) 80%, #8a3606);
      box-shadow: 0 4px 10px rgb(0 0 0 / .45);
      cursor: inherit;
    }
    .lever__knob:focus-visible { outline: 3px solid var(--cream); outline-offset: 3px; }
    .lever__pivot {
      position: absolute; left: var(--pivot-x); top: 50%; width: 30px; height: 30px;
      transform: translate(-50%, -50%); border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #f1d58c, #a37a22 60%, #5a420f);
      box-shadow: 0 2px 4px rgb(0 0 0 / .5);
      pointer-events: none;
    }
    .lever__tuut {
      position: absolute; left: 50%; top: -6px; transform: translateX(-50%);
      font: 800 1rem var(--font-display); color: var(--orange); letter-spacing: .04em;
      animation: tuut .9s ease-out forwards; pointer-events: none; white-space: nowrap;
    }
    .lever--honk { animation: shake .35s ease-in-out; }
    @keyframes tuut {
      from { opacity: 1; transform: translate(-50%, 0) scale(.9); }
      to { opacity: 0; transform: translate(-50%, -34px) scale(1.15); }
    }
    @keyframes shake {
      0%, 100% { translate: 0; }
      25% { translate: -3px 0; }
      75% { translate: 3px 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .lever__arm { transition-duration: .1s; }
      .lever--honk { animation: none; }
    }
  `,
})
export class KlaxonLeverComponent {
  private readonly klaxon = inject(KlaxonService);
  private readonly plate = viewChild.required<ElementRef<HTMLElement>>('plate');

  protected readonly angle = signal(0);
  protected readonly dragging = signal(false);
  protected readonly honking = signal(false);
  /** Direction du dernier klaxon de ce geste ; null = levier réarmé. */
  private lastTriggered: KlaxonDir | null = null;
  private honkTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Anime le levier à chaque klaxon, y compris ceux des autres visiteurs.
    let first = true;
    effect(() => {
      this.klaxon.honks();
      if (first) return void (first = false);
      untracked(() => {
        this.honking.set(false);
        clearTimeout(this.honkTimer);
        requestAnimationFrame(() => this.honking.set(true));
        this.honkTimer = setTimeout(() => this.honking.set(false), 900);
      });
    });
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.plate().nativeElement.setPointerCapture(event.pointerId);
    this.dragging.set(true);
    this.lastTriggered = null;
    this.follow(event);
  }

  protected onPointerMove(event: PointerEvent): void {
    if (this.dragging()) this.follow(event);
  }

  protected release(): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    this.angle.set(0);
  }

  protected onKey(event: KeyboardEvent): void {
    const dir: KlaxonDir | null = event.key === 'ArrowUp' ? 'haut' : event.key === 'ArrowDown' ? 'bas' : null;
    if (!dir) return;
    event.preventDefault();
    this.angle.set(dir === 'haut' ? -MAX_ANGLE : MAX_ANGLE);
    this.klaxon.honk(dir);
    setTimeout(() => this.angle.set(0), 180);
  }

  private follow(event: PointerEvent): void {
    const rect = this.plate().nativeElement.getBoundingClientRect();
    const pivotX = rect.left + 44;
    const pivotY = rect.top + rect.height / 2;
    let deg = (Math.atan2(event.clientY - pivotY, event.clientX - pivotX) * 180) / Math.PI;
    // Pointeur passé derrière le pivot : on reste en butée du côté où il se trouve.
    if (Math.abs(deg) > 90) deg = Math.sign(deg) * MAX_ANGLE;
    const angle = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, deg));
    this.angle.set(angle);

    // Un geste rapide peut sauter la zone centrale : changer de direction réarme aussi le levier.
    const dir: KlaxonDir = angle < 0 ? 'haut' : 'bas';
    if (Math.abs(angle) < REARM_ANGLE) this.lastTriggered = null;
    else if (Math.abs(angle) >= TRIGGER_ANGLE && this.lastTriggered !== dir) {
      this.lastTriggered = dir;
      this.klaxon.honk(dir);
    }
  }
}
