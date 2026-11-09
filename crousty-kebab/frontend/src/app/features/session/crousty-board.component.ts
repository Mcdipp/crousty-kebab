import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import type { CroustyProduct, Order } from '../../core/models';
import { CROUSTY_PRODUCTS, productName, type ProductInfo } from '../../core/products';
import { IconComponent } from '../../shared/icon.component';
import { ModalComponent } from '../../shared/modal.component';
import { SessionStore } from './session.store';

type TargetMode = 'me' | 'other' | 'new';

@Component({
  selector: 'app-crousty-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, ModalComponent],
  templateUrl: './crousty-board.component.html',
  styleUrl: './crousty-board.component.scss',
})
export class CroustyBoardComponent {
  protected readonly store = inject(SessionStore);
  protected readonly products = CROUSTY_PRODUCTS;
  protected readonly productName = productName;
  protected readonly stats = this.store.croustyStats;

  // ----- État de la fenêtre de commande -----
  readonly dialogOpen = signal(false);
  readonly editing = signal<Order | null>(null);
  readonly product = signal<CroustyProduct>('NATURE');
  readonly targetMode = signal<TargetMode>('me');
  readonly otherName = signal('');
  readonly newName = signal('');
  readonly quantity = signal(1);
  readonly notes = signal('');
  readonly formError = signal<string | null>(null);
  readonly toDelete = signal<Order | null>(null);

  readonly currentProduct = computed(() => this.products.find((p) => p.id === this.product())!);

  /** Noms proposés : participants + noms déjà ajoutés (hors moi). */
  readonly otherNames = computed(() => {
    const me = this.store.me()?.name.toLocaleLowerCase('fr-FR');
    const names = new Map<string, string>();
    for (const p of this.store.state()?.participants ?? []) names.set(p.name.toLocaleLowerCase('fr-FR'), p.name);
    for (const o of this.store.state()?.orders ?? []) names.set(o.targetName.toLocaleLowerCase('fr-FR'), o.targetName);
    if (me) names.delete(me);
    return [...names.values()];
  });

  readonly canOrder = computed(() => this.store.isOpen() && (!!this.store.identity() || this.store.isCreator()));

  openAdd(p: ProductInfo): void {
    this.editing.set(null);
    this.product.set(p.id);
    this.targetMode.set(this.store.me() ? 'me' : 'new');
    this.otherName.set(this.otherNames()[0] ?? '');
    this.newName.set('');
    this.quantity.set(1);
    this.notes.set('');
    this.formError.set(null);
    this.dialogOpen.set(true);
  }

  openEdit(o: Order): void {
    this.editing.set(o);
    this.product.set(o.productType);
    const meName = this.store.me()?.name;
    if (meName && o.targetName.toLocaleLowerCase('fr-FR') === meName.toLocaleLowerCase('fr-FR')) {
      this.targetMode.set('me');
    } else {
      this.targetMode.set('other');
      this.otherName.set(o.targetName);
    }
    this.newName.set('');
    this.quantity.set(o.quantity);
    this.notes.set(o.notes ?? '');
    this.formError.set(null);
    this.dialogOpen.set(true);
  }

  step(delta: number): void {
    this.quantity.update((q) => Math.min(20, Math.max(1, q + delta)));
  }

  private targetName(): string {
    switch (this.targetMode()) {
      case 'me':
        return this.store.me()?.name ?? '';
      case 'other':
        return this.otherName().trim();
      case 'new':
        return this.newName().trim().replace(/\s+/g, ' ');
    }
  }

  async submit(): Promise<void> {
    const targetName = this.targetName();
    if (!targetName) {
      this.formError.set('Indique pour qui est cette commande.');
      return;
    }
    if (targetName.length > 30) {
      this.formError.set('Le nom ne doit pas dépasser 30 caractères.');
      return;
    }
    this.formError.set(null);
    const payload = {
      targetName,
      productType: this.product(),
      quantity: this.quantity(),
      notes: this.notes().trim() || null,
    };
    const edit = this.editing();
    const ok = edit ? await this.store.updateOrder(edit.id, payload) : await this.store.addOrder(payload);
    if (ok) this.dialogOpen.set(false);
  }

  async confirmDelete(): Promise<void> {
    const o = this.toDelete();
    if (!o) return;
    if (await this.store.deleteOrder(o.id)) this.toDelete.set(null);
  }

  ownerName(o: Order): string {
    return this.store.state()?.participants.find((p) => p.id === o.participantId)?.name ?? '';
  }
}
