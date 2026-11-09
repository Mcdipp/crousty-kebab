import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  show(message: string, kind: ToastKind = 'info', durationMs = 3500): void {
    const id = this.nextId++;
    this.toasts.update((t) => [...t.slice(-2), { id, kind, message }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  success = (m: string) => this.show(m, 'success');
  error = (m: string) => this.show(m, 'error', 5000);
  info = (m: string) => this.show(m, 'info');

  dismiss(id: number): void {
    this.toasts.update((t) => t.filter((x) => x.id !== id));
  }
}
