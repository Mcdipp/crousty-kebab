import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-share-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="share">
      <button type="button" class="btn btn--light" (click)="copyLink()">
        <app-icon name="copy" [size]="18" /> Copier le lien
      </button>
    </div>
  `,
  styles: `
    .share { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 4px; }
  `,
})
export class ShareLinkComponent {
  readonly sessionId = input.required<string>();
  private readonly toast = inject(ToastService);

  private link(): string {
    return `${location.origin}/session/${this.sessionId()}`;
  }

  protected async copyLink(): Promise<void> {
    const url = this.link();
    (await copyText(url))
      ? this.toast.success('Lien copié 🔗')
      : this.toast.error('Impossible de copier automatiquement : ' + url);
  }

}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Repli pour les navigateurs sans API Clipboard (HTTP, anciens iOS…)
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
