import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { KlaxonLeverComponent } from './shared/klaxon-lever.component';
import { KlaxonService } from './shared/klaxon.service';
import { ToastsComponent } from './shared/toasts.component';

/** Nombre de clics sur le pied de page pour faire apparaître le levier. */
const EASTER_EGG_CLICKS = 10;
/** Au-delà de ce délai entre deux clics, le compteur repart de zéro. */
const EASTER_EGG_GAP_MS = 2000;

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, ToastsComponent, KlaxonLeverComponent],
  template: `
    <a class="skip" href="#main">Aller au contenu</a>
    <header class="topbar">
      <div class="container topbar__inner">
        <a routerLink="/" class="brand" aria-label="Crousty & Kebab - accueil">
          <img src="icons/vrai-logo.png" alt="" width="55" height="55" />
          <span>Crousty <em>&amp;</em> Kebab</span>
        </a>
      </div>
    </header>
    <main id="main">
      <router-outlet />
    </main>
    <footer class="footer container">
      <span class="footer__text" (click)="onFooterClick()">Fait avec bib, tres et un amour pour wokami</span>
      @if (leverVisible() && isHome()) {
        <app-klaxon-lever />
      }
    </footer>
    <app-toasts />
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 100dvh; }
    .skip { position: absolute; left: -9999px; }
    .skip:focus { left: 16px; top: 8px; z-index: 100; background: #fff; padding: 8px 12px; border-radius: 8px; }
    .topbar {
      position: sticky; top: 0; z-index: 50; background: var(--ink); color: var(--cream);
      padding-top: env(safe-area-inset-top);
    }
    .topbar__inner { display: flex; align-items: center; height: 60px; }
    .brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; font: 800 1.2rem var(--font-display); letter-spacing: -0.01em; }
    .brand em { color: var(--orange); font-style: normal; }
    main { flex: 1; padding-bottom: 32px; }
    .footer { text-align: center; color: var(--ink-50); font-size: .85rem; padding-bottom: calc(24px + env(safe-area-inset-bottom)); }
    .footer__text { user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
  `,
})
export class App {
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  protected readonly isHome = computed(() => this.url().split(/[?#]/)[0] === '/');
  protected readonly leverVisible = signal(false);
  private clicks = 0;
  private lastClick = 0;

  constructor() {
    // Écoute les klaxons des autres dès le démarrage (reçus uniquement sur l'accueil).
    inject(KlaxonService);
    // Le levier disparaît dès qu'on quitte l'accueil : il faudra le retrouver.
    effect(() => {
      if (this.isHome()) return;
      this.leverVisible.set(false);
      this.clicks = 0;
    });
  }

  protected onFooterClick(): void {
    if (!this.isHome() || this.leverVisible()) return;
    const now = Date.now();
    this.clicks = now - this.lastClick > EASTER_EGG_GAP_MS ? 1 : this.clicks + 1;
    this.lastClick = now;
    if (this.clicks >= EASTER_EGG_CLICKS) this.leverVisible.set(true);
  }
}
