import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import type { ParticipationChoice } from '../../core/models';
import { CHOICE_LABEL } from '../../core/products';
import { IconComponent } from '../../shared/icon.component';
import { SessionStore } from './session.store';

@Component({
  selector: 'app-tacos-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (store.me() && store.isOpen()) {
      <section class="card mine" aria-labelledby="mine-h">
        <h2 id="mine-h">{{ store.myParticipation() ? 'Ton choix' : 'Tu viens ?' }}</h2>
        <div class="choices" role="radiogroup" aria-label="Ton choix">
          @for (c of choices(); track c.value) {
            <button type="button" role="radio" class="choice" [class.choice--on]="choice() === c.value"
                    [attr.aria-checked]="choice() === c.value" (click)="choice.set(c.value)">
              <span aria-hidden="true">{{ c.emoji }}</span>{{ c.label }}
            </button>
          }
        </div>
        <div class="field">
          <label for="precision">Précision sur ta commande <span class="muted">(facultatif)</span></label>
          <input id="precision" class="input" maxlength="200" placeholder="Ex : tacos XL poulet-cordon bleu, sauce algérienne"
                 [value]="notes()" (input)="notes.set($any($event.target).value)" />
        </div>
        <div class="actions">
          <button type="button" class="btn btn--lg btn--red" [disabled]="!choice() || store.busy()" (click)="save()">
            <app-icon name="check" /> {{ store.myParticipation() ? 'Modifier mon choix' : 'Je viens !' }}
          </button>
          @if (store.myParticipation()) {
            <button type="button" class="btn btn--ghost" [disabled]="store.busy()" (click)="store.removeParticipation(store.me()!.id)">
              <app-icon name="logout" /> Me retirer de la sortie
            </button>
          }
        </div>
      </section>
    }

    <section class="stats" aria-label="Récapitulatif">
      <div class="stat stat--main"><strong>{{ stats().total }}</strong><span>Participant(s)</span></div>
      @if (store.session()?.foodChoice !== 'KEBAB') {
        <div class="stat"><strong>{{ stats().tacos }}</strong><span>🌯 Tacos</span></div>
      }
      @if (store.session()?.foodChoice !== 'TACOS') {
        <div class="stat"><strong>{{ stats().kebab }}</strong><span>🥙 Kebab</span></div>
      }
    </section>

    <section class="card" aria-labelledby="who-h">
      <h2 id="who-h">Qui va au {{ title() }} ?</h2>
      @if (stats().going.length === 0) {
        <p class="empty">Personne pour l’instant… Lance la dynamique ! 🔥</p>
      } @else {
        <ul class="who">
          @for (g of stats().going; track g.id) {
            <li [class.me]="g.participantId === store.me()?.id">
              <span class="avatar" aria-hidden="true">{{ g.name.charAt(0).toUpperCase() }}</span>
              <div class="who__txt">
                <strong>{{ g.name }}</strong> : <span class="pill" [class.pill--kebab]="g.choice === 'KEBAB'">{{ label[g.choice] }}</span>
                @if (g.notes) { <small>{{ g.notes }}</small> }
              </div>
              @if (store.isCreator() && store.isOpen() && g.participantId !== store.me()?.id) {
                <button type="button" class="icon-btn icon-btn--danger" (click)="store.removeParticipation(g.participantId)"
                        [attr.aria-label]="'Retirer ' + g.name + ' de la sortie'">
                  <app-icon name="x" [size]="18" />
                </button>
              }
            </li>
          }
        </ul>
      }
      @if (stats().pending.length) {
        <p class="pending muted">Pas encore répondu : {{ pendingNames() }}</p>
      }
    </section>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 16px; }
    .mine { border: 3px solid var(--red-dark); }
    .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .choice {
      display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 14px; border-radius: 16px;
      border: 2px solid var(--border); background: #fff; font: 800 1.1rem var(--font-display); cursor: pointer; color: var(--ink);
      span { font-size: 2.2rem; line-height: 1; }
    }
    .choice--on { border-color: var(--red-dark); background: #fbe6e2; box-shadow: inset 0 0 0 1px var(--red-dark); }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .actions .btn { flex: 1 1 200px; }
    .stats { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); }
    .stat {
      background: var(--surface); border-radius: 16px; padding: 12px 14px; box-shadow: var(--shadow); display: flex; flex-direction: column;
      strong { font: 800 1.8rem/1.1 var(--font-display); }
      span { font-size: .85rem; color: var(--ink-70); font-weight: 600; }
    }
    .stat--main { background: var(--red-dark); color: #fff; span { color: rgb(255 255 255 / .9); } }
    .empty { text-align: center; color: var(--ink-70); padding: 16px 0 4px; margin: 0; }
    .who { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .who li { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 14px; background: var(--cream); }
    .who li.me { background: #fbe6e2; }
    .who__txt { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .who small { display: block; color: var(--ink-70); font-size: .85rem; }
    .avatar {
      width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0;
      background: var(--ink); color: var(--cream); font: 800 1.1rem var(--font-display);
    }
    .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; background: var(--orange); color: #fff; font-weight: 800; font-size: .85rem; }
    .pill--kebab { background: var(--red-dark); }
    .pending { margin: 12px 0 0; font-size: .9rem; }
  `,
})
export class TacosBoardComponent {
  protected readonly store = inject(SessionStore);
  protected readonly stats = this.store.tacosStats;
  protected readonly label = CHOICE_LABEL;

  readonly choice = signal<ParticipationChoice | null>(null);
  readonly notes = signal('');

  readonly choices = computed(() => {
    const fc = this.store.session()?.foodChoice ?? 'BOTH';
    const all: { value: ParticipationChoice; label: string; emoji: string }[] = [
      { value: 'TACOS', label: 'Tacos', emoji: '🌯' },
      { value: 'KEBAB', label: 'Kebab', emoji: '🥙' },
    ];
    return fc === 'BOTH' ? all : all.filter((c) => c.value === fc);
  });

  readonly title = computed(() => {
    const fc = this.store.session()?.foodChoice;
    return fc === 'TACOS' ? 'TACOS' : fc === 'KEBAB' ? 'KEBAB' : 'TACOS / KEBAB';
  });

  readonly pendingNames = computed(() => this.stats().pending.map((p) => p.name).join(', '));

  constructor() {
    // Pré-remplit le formulaire avec le choix existant (ou l'unique option possible).
    // On ne réagit qu'aux vrais changements de MA participation (pas à chaque mise à jour temps réel),
    // pour ne pas écraser une saisie en cours.
    const myKey = computed(() => {
      const p = this.store.myParticipation();
      return p ? `${p.id}:${p.updatedAt}` : '';
    });
    const optionsKey = computed(() => this.choices().map((c) => c.value).join(','));
    effect(() => {
      myKey();
      optionsKey();
      untracked(() => {
        const mine = this.store.myParticipation();
        const options = this.choices();
        if (mine) {
          this.choice.set(mine.choice);
          this.notes.set(mine.notes ?? '');
        } else if (options.length === 1) {
          this.choice.set(options[0]!.value);
        }
      });
    });
  }

  save(): void {
    const c = this.choice();
    if (c) void this.store.participate(c, this.notes().trim() || null);
  }
}
