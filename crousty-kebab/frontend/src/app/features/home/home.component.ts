import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { IdentityService } from '../../core/identity.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly identity = inject(IdentityService);

  readonly name = signal(this.identity.name());
  readonly code = signal('');
  readonly nameError = signal<string | null>(null);
  readonly joinError = signal<string | null>(null);
  readonly joining = signal(false);

  private validName(): string | null {
    const n = this.name().trim().replace(/\s+/g, ' ');
    if (!n) {
      this.nameError.set('Dis-nous d’abord comment tu t’appelles 😉');
      document.getElementById('name')?.focus();
      return null;
    }
    if (n.length > 30) {
      this.nameError.set('30 caractères maximum.');
      return null;
    }
    if (!/^[\p{L}\p{N}][\p{L}\p{N} _'.-]*$/u.test(n)) {
      this.nameError.set('Lettres, chiffres, espaces et - \' _ . uniquement.');
      return null;
    }
    this.nameError.set(null);
    this.identity.setName(n);
    return n;
  }

  onNameInput(v: string): void {
    this.name.set(v);
    if (this.nameError()) this.nameError.set(null);
  }

  onCodeInput(v: string): void {
    this.code.set(v.replace(/\D/g, '').slice(0, 4));
    this.joinError.set(null);
  }

  create(type: 'crousty' | 'tacos-kebab'): void {
    if (!this.validName()) return;
    void this.router.navigate(['/creer', type]);
  }

  async join(): Promise<void> {
    const name = this.validName();
    if (!name) return;
    const code = this.code();
    if (!/^\d{4}$/.test(code)) {
      this.joinError.set('Le code contient 4 chiffres.');
      return;
    }
    this.joining.set(true);
    try {
      // Vérifie l'existence avant de naviguer, pour un message d'erreur immédiat.
      const { state } = await this.api.getSessionByCode(code);
      const known = this.identity.get(state.session.id);
      if (!known && state.session.status === 'CLOSED') {
        this.joinError.set('Cette session est clôturée : la commande a déjà été passée.');
        return;
      }
      await this.router.navigate(['/session', code], { queryParams: known ? {} : { rejoindre: 1 } });
    } catch (e) {
      this.joinError.set((e as Error).message);
    } finally {
      this.joining.set(false);
    }
  }
}
