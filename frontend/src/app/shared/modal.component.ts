import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { IconComponent } from './icon.component';

/** Fenêtre modale accessible basée sur <dialog> (focus piégé, Échap, fond cliquable). */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <dialog #dlg class="modal" [attr.aria-labelledby]="titleId" (close)="closed.emit()" (click)="onBackdrop($event)">
      <div class="modal__inner">
        <header class="modal__head">
          <h2 [id]="titleId">{{ title() }}</h2>
          <button type="button" class="icon-btn" aria-label="Fermer" (click)="dlg.close()">
            <app-icon name="x" />
          </button>
        </header>
        <ng-content />
      </div>
    </dialog>
  `,
  styles: `
    .modal {
      border: 0; padding: 0; border-radius: 24px; width: min(94vw, 480px); max-height: 90dvh;
      background: var(--cream); color: var(--ink); box-shadow: var(--shadow-lg);
    }
    .modal::backdrop { background: rgb(26 20 16 / .55); backdrop-filter: blur(3px); }
    .modal[open] { animation: pop .2s ease-out; }
    .modal__inner { padding: 20px; }
    .modal__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .modal__head h2 { margin: 0; font-size: 1.3rem; }
    @media (max-width: 520px) {
      .modal { margin: auto auto 0; width: 100vw; max-width: 100vw; border-radius: 24px 24px 0 0; }
      .modal__inner { padding-bottom: calc(20px + env(safe-area-inset-bottom)); }
    }
    @keyframes pop { from { opacity: 0; transform: translateY(16px); } }
    @media (prefers-reduced-motion: reduce) { .modal[open] { animation: none; } }
  `,
})
export class ModalComponent {
  private static seq = 0;
  readonly title = input.required<string>();
  readonly open = input(false);
  readonly closed = output<void>();
  protected readonly titleId = `modal-title-${++ModalComponent.seq}`;
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      if (this.open() && !el.open) el.showModal();
      if (!this.open() && el.open) el.close();
    });
  }

  protected onBackdrop(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.dlg().nativeElement.close();
  }
}
