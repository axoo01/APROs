import { Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  readonly message: string;
  readonly action: ToastAction | null;
}

export interface ToastOptions {
  readonly message: string;
  readonly tone?: ToastTone;
  readonly action?: ToastAction;
  /** ms; 0 = sticky. */
  readonly durationMs?: number;
}

const MAX_VISIBLE = 3;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private seq = 0;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly _toasts = signal<readonly Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  /** Extra bottom clearance (px) while a screen docks a bar above the bottom nav (e.g. attendance closeout). */
  readonly bottomInset = signal(0);

  show(opts: ToastOptions): number {
    const id = ++this.seq;
    const toast: Toast = { id, tone: opts.tone ?? 'info', message: opts.message, action: opts.action ?? null };
    this._toasts.update((list) => [...list, toast].slice(-MAX_VISIBLE));
    const duration = opts.durationMs ?? (opts.action ? 6000 : 3500);
    if (duration > 0) this.timers.set(id, setTimeout(() => this.dismiss(id), duration));
    return id;
  }

  dismiss(id: number): void {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
