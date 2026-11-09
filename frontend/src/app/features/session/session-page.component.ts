import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { IdentityService } from '../../core/identity.service';
import { formatHour } from '../../core/time';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';
import { ShareCodeComponent } from '../../shared/share-code.component';
import { CroustyBoardComponent } from './crousty-board.component';
import { SessionStore } from './session.store';
import { TacosBoardComponent } from './tacos-board.component';

@Component({
  selector: 'app-session-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SessionStore],
  imports: [RouterLink, IconComponent, ModalComponent, ShareCodeComponent, CroustyBoardComponent, TacosBoardComponent],
  templateUrl: './session-page.component.html',
  styleUrl: './session-page.component.scss',
})
export class SessionPageComponent {
  protected readonly store = inject(SessionStore);
  private readonly api = inject(ApiService);
  private readonly identityService = inject(IdentityService);
  private readonly title = inject(Title);

  /** Paramètre de route :code */
  readonly code = input.required<string>();
  /** ?rejoindre=1 : rejoindre automatiquement avec le pseudo mémorisé */
  readonly rejoindre = input<string | undefined>();

  readonly joinName = signal(this.identityService.name());
  readonly joinError = signal<string | null>(null);
  readonly confirmClose = signal(false);
  readonly croustyPhone = signal('0554796424');

  readonly s = this.store.session;
  readonly isTacos = computed(() => this.s()?.type === 'TACOS_KEBAB');
  readonly heading = computed(() => (this.isTacos() ? 'SORTIE TACOS / KEBAB' : 'CROUSTY — SESSION'));
  readonly hour = computed(() => (this.s() ? formatHour(this.s()!.scheduledAt) : ''));
  readonly closedHour = computed(() => (this.s()?.closedAt ? formatHour(this.s()!.closedAt!) : ''));
  readonly phoneDisplay = computed(() => this.croustyPhone().replace(/(\d{2})(?=\d)/g, '$1 ').trim());
  readonly needsJoin = computed(() => !this.store.loading() && !!this.s() && !this.store.identity());

  private autoJoinTried = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => this.store.destroy());

    effect(() => {
      const code = this.code();
      untracked(() => void this.store.load(code));
    });

    effect(() => {
      const s = this.s();
      if (s) this.title.setTitle(`${s.type === 'CROUSTY' ? 'Crousty' : 'Tacos / Kebab'} #${s.code} — Crousty & Kebab`);
    });

    // Rejoindre automatiquement si l'utilisateur vient de l'accueil avec son pseudo.
    effect(() => {
      if (!this.needsJoin() || this.autoJoinTried) return;
      this.autoJoinTried = true;
      const name = untracked(() => this.joinName().trim());
      if (this.rejoindre() && name && this.s()?.status === 'OPEN') untracked(() => void this.join());
    });

    this.api
      .getConfig()
      .then((c) => this.croustyPhone.set(c.croustyPhone))
      .catch(() => undefined);
  }

  async join(): Promise<void> {
    const name = this.joinName().trim().replace(/\s+/g, ' ');
    if (!name) {
      this.joinError.set('Indique ton prénom pour rejoindre.');
      return;
    }
    this.joinError.set(null);
    const ok = await this.store.join(name);
    if (!ok) this.joinError.set('Impossible de rejoindre : vérifie le message ci-dessous et essaie un autre pseudo.');
  }

  async doClose(): Promise<void> {
    const ok = await this.store.close();
    if (ok) this.confirmClose.set(false);
  }
}
