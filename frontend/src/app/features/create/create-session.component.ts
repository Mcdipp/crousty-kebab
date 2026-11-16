import { ChangeDetectionStrategy, Component, type OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { IdentityService } from '../../core/identity.service';
import type { FoodChoice, SessionType } from '../../core/models';
import { dateTimeToDate, dayValue, defaultTimeValue, timeValueToDate } from '../../core/time';
import { ToastService } from '../../core/toast.service';
import { IconComponent } from '../../shared/icon.component';

@Component({
  selector: 'app-create-session',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, IconComponent],
  template: `
    <div class="container narrow">
      <a routerLink="/" class="back"><app-icon name="arrowLeft" [size]="18" /> Accueil</a>
      <header class="head" [class.head--tacos]="isTacos()">
        <img [src]="isTacos() ? 'images/tacos-kebab-hero.png' : 'images/crousty-hero.png'" alt="" width="120" height="78" />
        <div>
          <p class="kicker">Nouvelle session</p>
          <h1>{{ isTacos() ? 'Sortie Tacos / Kebab' : 'Session Crousty' }}</h1>
        </div>
      </header>

      <form class="card" (submit)="$event.preventDefault(); submit()" novalidate>
        <div class="field">
          <label for="creator">Ton prénom</label>
          <input id="creator" class="input" name="creator" maxlength="30" autocomplete="nickname"
                 [(ngModel)]="name" required placeholder="Ton prénom ou pseudo" />
        </div>

        @if (isTacos()) {
          <fieldset class="field choices">
            <legend class="label">Quel jour ?</legend>
            <div class="seg" role="radiogroup">
              @for (d of quickDays; track d.value) {
                <label class="seg__opt" [class.seg__opt--on]="day() === d.value">
                  <input type="radio" name="day" [value]="d.value" [checked]="day() === d.value" (change)="day.set(d.value)" />
                  {{ d.label }}
                </label>
              }
              <label class="seg__opt seg__opt--date" [class.seg__opt--on]="!isQuickDay()">
                <span class="visually-hidden">Autre jour</span>
                <input type="date" name="date" class="seg__date" [min]="minDay" [max]="maxDay" [value]="day()"
                       (change)="day.set($any($event.target).value)" />
              </label>
            </div>
          </fieldset>

          <div class="field">
            <label for="time">Heure du rendez-vous</label>
            <input id="time" class="input input--time" type="time" name="time" step="300" [(ngModel)]="time" required />
          </div>

          <fieldset class="field choices">
            <legend class="label">On va où ?</legend>
            <div class="seg" role="radiogroup">
              @for (c of foodChoices; track c.value) {
                <label class="seg__opt" [class.seg__opt--on]="foodChoice() === c.value">
                  <input type="radio" name="food" [value]="c.value" [checked]="foodChoice() === c.value"
                         (change)="foodChoice.set(c.value)" />
                  <span class="seg__emoji" aria-hidden="true">{{ c.emoji }}</span>{{ c.label }}
                </label>
              }
            </div>
          </fieldset>
        } @else {
          <div class="field">
            <label for="time">Heure prévue de la commande</label>
            <input id="time" class="input input--time" type="time" name="time" step="300" [(ngModel)]="time" required />
            <span class="hint">Si l’heure est déjà passée, on considère que c’est pour demain.</span>
          </div>
        }

        <div class="field">
          <label for="desc">Description <span class="muted">(facultatif)</span></label>
          <textarea id="desc" class="textarea" name="desc" maxlength="300" [(ngModel)]="description"
                    [placeholder]="isTacos() ? 'Ex : rendez-vous devant la BU' : 'Ex : pause déj entre deux cours'"></textarea>
        </div>

        @if (error()) {
          <p class="error-text" role="alert">{{ error() }}</p>
        }

        <button type="submit" class="btn btn--lg btn--block" [class.btn--red]="isTacos()" [disabled]="submitting()">
          @if (submitting()) { Création… } @else { <app-icon name="check" /> Créer la session }
        </button>
      </form>
    </div>
  `,
  styles: `
    .narrow { max-width: 560px; padding-top: 16px; }
    .back { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; text-decoration: none; color: var(--ink-70); padding: 8px 0; }
    .head { display: flex; align-items: center; gap: 14px; margin: 8px 0 16px; }
    .head img { width: 96px; height: auto; border-radius: 16px; background: var(--orange-100); }
    .head--tacos img { background: #f6d7c7; }
    .head h1 { margin: 0; font-size: clamp(1.6rem, 6vw, 2.2rem); }
    .kicker { margin: 0; font-weight: 800; color: var(--orange-600); text-transform: uppercase; letter-spacing: .1em; font-size: .75rem; }
    .input--time { font: 800 1.6rem var(--font-display); }
    .choices { border: 0; padding: 0; margin: 0 0 14px; }
    .seg { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .seg__opt {
      display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; border-radius: 14px;
      border: 2px solid var(--border); background: #fff; font-weight: 700; cursor: pointer; text-align: center;
    }
    .seg__opt input { position: absolute; opacity: 0; pointer-events: none; }
    .seg__opt:has(input:focus-visible) { outline: 3px solid var(--orange); outline-offset: 2px; }
    .seg__opt--on { border-color: var(--red-dark); background: #fbe6e2; }
    .seg__emoji { font-size: 1.6rem; }
    .seg__opt--date { padding: 6px; justify-content: center; }
    .seg__opt--date input.seg__date {
      position: static; opacity: 1; pointer-events: auto; width: 100%; min-width: 0; border: 0; background: transparent;
      font: inherit; text-align: center; color: inherit;
    }
  `,
})
export class CreateSessionComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly identity = inject(IdentityService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Fourni par la configuration de route (data.type). */
  readonly type = input<SessionType>('CROUSTY');
  readonly isTacos = computed(() => this.type() === 'TACOS_KEBAB');

  readonly name = signal(this.identity.name());
  readonly time = signal(defaultTimeValue());
  readonly quickDays = [
    { value: dayValue(0), label: 'Aujourd’hui' },
    { value: dayValue(1), label: 'Demain' },
  ];
  readonly minDay = dayValue(0);
  readonly maxDay = dayValue(6);
  /** Une sortie, c'est souvent « demain on y va ? ». */
  readonly day = signal(dayValue(1));
  readonly isQuickDay = computed(() => this.quickDays.some((d) => d.value === this.day()));
  readonly description = signal('');
  readonly foodChoice = signal<FoodChoice>('BOTH');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly foodChoices: { value: FoodChoice; label: string; emoji: string }[] = [
    { value: 'TACOS', label: 'Tacos', emoji: '🌯' },
    { value: 'KEBAB', label: 'Kebab', emoji: '🥙' },
    { value: 'BOTH', label: 'À décider', emoji: '🤔' },
  ];

  ngOnInit(): void {
    // Les inputs de route ne sont disponibles qu'ici. Sortie : midi par défaut.
    if (this.isTacos()) this.time.set('12:00');
  }

  async submit(): Promise<void> {
    const name = this.name().trim().replace(/\s+/g, ' ');
    if (!name) return this.error.set('Indique ton prénom.');
    const when = this.isTacos() ? dateTimeToDate(this.day(), this.time()) : timeValueToDate(this.time());
    if (!when) return this.error.set(this.isTacos() ? 'Choisis un jour et une heure valides.' : 'Choisis une heure valide.');
    if (this.isTacos() && when.getTime() < Date.now()) {
      return this.error.set('Ce moment est déjà passé : choisis une autre heure ou un autre jour.');
    }
    this.error.set(null);
    this.submitting.set(true);
    try {
      const res = await this.api.createSession({
        type: this.type(),
        creatorName: name,
        scheduledAt: when.toISOString(),
        description: this.description().trim() || undefined,
        ...(this.isTacos() ? { foodChoice: this.foodChoice() } : {}),
      });
      this.identity.setName(name);
      this.identity.save(res.state.session.id, {
        participantId: res.participantId,
        participantToken: res.participantToken,
        creatorToken: res.creatorToken,
        name,
      });
      this.toast.success('Session créée ! Partage le lien 🎉');
      await this.router.navigate(['/session', res.state.session.id]);
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.submitting.set(false);
    }
  }
}
