import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { OUTING_LABEL } from '../../core/products';
import { IconComponent } from '../../shared/icon.component';
import { SessionStore } from './session.store';

/** Sortie Tacos / Kebab : on indique juste si on vient (avec un petit mot facultatif). */
@Component({
  selector: 'app-tacos-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    @if (store.me() && store.isOpen()) {
      <section class="card mine" aria-labelledby="mine-h">
        <h2 id="mine-h">{{ store.myParticipation() ? 'Tu viens 🙌' : 'Tu viens ?' }}</h2>
        <div class="field">
          <label for="note">Un petit mot <span class="muted">(facultatif)</span></label>
          <input id="note" class="input" maxlength="200" placeholder="Ex : j’arrive vers 12h15, je finis de chepomaxer"
                 [value]="notes()" (input)="notes.set($any($event.target).value)" />
        </div>
        <div class="actions">
          @if (store.myParticipation()) {
            <button type="button" class="btn btn--lg btn--red" [disabled]="store.busy() || !notesChanged()" (click)="save()">
              <app-icon name="check" /> Mettre à jour mon petit mot
            </button>
            <button type="button" class="btn btn--ghost" [disabled]="store.busy()" (click)="store.removeParticipation(store.me()!.id)">
              <app-icon name="logout" /> Finalement, je ne viens pas
            </button>
          } @else {
            <button type="button" class="btn btn--lg btn--red" [disabled]="store.busy()" (click)="save()">
              <app-icon name="check" /> J’y vais !
            </button>
          }
        </div>
      </section>
    }

    <section class="stats" aria-label="Récapitulatif">
      <div class="stat stat--main"><strong>{{ stats().total }}</strong><span>{{ stats().total > 1 ? 'Personnes partantes' : 'Personne partante' }}</span></div>
      <div class="stat"><strong>{{ stats().pending.length }}</strong><span>Pas encore répondu</span></div>
    </section>

    <section class="card" aria-labelledby="who-h">
      <h2 id="who-h">Qui vient au {{ title() }} ?</h2>
      @if (stats().going.length === 0) {
        <p class="empty">Personne pour l’instant. Sois la première personne à dire oui ! 🔥</p>
      } @else {
        <ul class="who">
          @for (g of stats().going; track g.id) {
            <li [class.me]="g.participantId === store.me()?.id">
              <span class="avatar" aria-hidden="true">{{ g.name.charAt(0).toUpperCase() }}</span>
              <div class="who__txt">
                <strong>{{ g.name }}</strong>
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
    .actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .actions .btn { flex: 1 1 200px; }
    .stats { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
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
    .pending { margin: 12px 0 0; font-size: .9rem; }
  `,
})
export class TacosBoardComponent {
  protected readonly store = inject(SessionStore);
  protected readonly stats = this.store.tacosStats;

  readonly notes = signal('');

  readonly title = computed(() => OUTING_LABEL[this.store.session()?.foodChoice ?? 'BOTH'].toUpperCase());
  readonly pendingNames = computed(() => this.stats().pending.map((p) => p.name).join(', '));
  readonly notesChanged = computed(() => (this.store.myParticipation()?.notes ?? '') !== this.notes().trim());

  constructor() {
    // Pré-remplit le petit mot uniquement quand MA participation change vraiment
    // (pas à chaque mise à jour temps réel), pour ne pas écraser une saisie en cours.
    const myKey = computed(() => {
      const p = this.store.myParticipation();
      return p ? `${p.id}:${p.updatedAt}` : '';
    });
    effect(() => {
      myKey();
      untracked(() => this.notes.set(this.store.myParticipation()?.notes ?? ''));
    });
  }

  save(): void {
    void this.store.participate(this.notes().trim() || null);
  }
}
