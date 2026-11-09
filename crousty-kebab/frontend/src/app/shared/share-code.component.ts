import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ToastService } from '../core/toast.service';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-share-code',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="share">
      <div class="share__label">Code de la session</div>
      <div class="share__code" aria-label="Code {{ spelled() }}">
        @for (d of digits(); track $index) {
          <span>{{ d }}</span>
        }
      </div>
      <div class="share__actions">
        <button type="button" class="btn btn--light" (click)="copyCode()">
          <app-icon name="copy" [size]="18" /> Copier le code
        </button>
        <button type="button" class="btn btn--light" (click)="shareLink()">
          <app-icon name="share" [size]="18" /> Partager le lien
        </button>
      </div>
    </div>
  `,
  styles: `
    .share { text-align: center; }
    .share__label { font-size: .8rem; text-transform: uppercase; letter-spacing: .12em; font-weight: 700; opacity: .8; }
    .share__code { display: flex; justify-content: center; gap: 8px; margin: 8px 0 14px; }
    .share__code span {
      width: 56px; height: 68px; display: grid; place-items: center; border-radius: 14px;
      background: var(--cream); color: var(--ink); font: 800 2.4rem/1 var(--font-display);
      box-shadow: inset 0 -4px 0 rgb(0 0 0 / .12);
    }
    .share__actions { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  `,
})
export class ShareCodeComponent {
  readonly code = input.required<string>();
  readonly title = input('Rejoins la session !');
  private readonly toast = inject(ToastService);

  protected digits = () => this.code().split('');
  protected spelled = () => this.code().split('').join(' ');

  private link(): string {
    return `${location.origin}/session/${this.code()}`;
  }

  protected async copyCode(): Promise<void> {
    (await copyText(this.code()))
      ? this.toast.success(`Code ${this.code()} copié 📋`)
      : this.toast.error('Impossible de copier automatiquement. Note le code : ' + this.code());
  }

  protected async shareLink(): Promise<void> {
    const url = this.link();
    const text = `${this.title()} Code : ${this.code()}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Crousty & Kebab', text, url });
        return;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') return;
      }
    }
    (await copyText(`${text} → ${url}`))
      ? this.toast.success('Lien copié, colle-le dans ton groupe 🔗')
      : this.toast.error('Partage impossible : ' + url);
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
