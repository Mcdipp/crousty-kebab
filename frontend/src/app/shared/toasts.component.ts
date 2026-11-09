import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-toasts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <button type="button" class="toast" [class]="'toast toast--' + t.kind" (click)="toast.dismiss(t.id)">
          <app-icon [name]="t.kind === 'error' ? 'alert' : t.kind === 'success' ? 'check' : 'info'" [size]="18" />
          <span>{{ t.message }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .toasts {
      position: fixed; z-index: 1000; left: 50%; transform: translateX(-50%);
      bottom: calc(16px + env(safe-area-inset-bottom)); width: min(92vw, 440px);
      display: flex; flex-direction: column; gap: 8px; pointer-events: none;
    }
    .toast {
      pointer-events: auto; display: flex; align-items: center; gap: 10px; text-align: left;
      padding: 12px 14px; border-radius: 14px; border: 0; font: inherit; font-weight: 600; font-size: .95rem;
      background: var(--ink); color: var(--cream); box-shadow: var(--shadow-lg);
      animation: toast-in .25s ease-out; cursor: pointer;
    }
    .toast--success { background: #1f6b3a; }
    .toast--error { background: var(--red-dark); }
    @keyframes toast-in { from { opacity: 0; transform: translateY(10px) scale(.98); } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  `,
})
export class ToastsComponent {
  protected readonly toast = inject(ToastService);
}
