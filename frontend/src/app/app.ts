import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ToastsComponent } from './shared/toasts.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, ToastsComponent],
  template: `
    <a class="skip" href="#main">Aller au contenu</a>
    <header class="topbar">
      <div class="container topbar__inner">
        <a routerLink="/" class="brand" aria-label="Crousty & Kebab — accueil">
          <img src="icons/logo.png" alt="" width="55" height="55" />
          <span>Crousty <em>&amp;</em> Kebab</span>
        </a>
      </div>
    </header>
    <main id="main">
      <router-outlet />
    </main>
    <footer class="footer container">Fait avec bib, tres et un amour pour wokami</footer>
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
  `,
})
export class App {}
