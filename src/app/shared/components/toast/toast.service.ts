import { Injectable, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

/** Small coloured badge shown instead of the tone icon (e.g. the status letter that was just recorded). */
export interface ToastBadge {
  readonly text: string;
  /** Utility classes for the badge fill, e.g. `bg-status-p text-on-status-p`. */
  readonly className: string;
}

export interface Toast {
  readonly id: number;
  readonly tone: ToastTone;
  readonly message: string;
  readonly action: ToastAction | null;
  readonly badge: ToastBadge | null;
  readonly group: string | null;
}

export interface ToastOptions {
  readonly message: string;
  readonly tone?: ToastTone;
  readonly action?: ToastAction;
  /** ms; 0 = sticky. */
  readonly durationMs?: number;
  readonly badge?: ToastBadge;
  /** A new toast replaces any visible toast of the same group (rapid sweeping shows one pill, not a stack). */
  readonly group?: string;
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
    const toast: Toast = {
      id,
      tone: opts.tone ?? 'info',
      message: opts.message,
      action: opts.action ?? null,
      badge: opts.badge ?? null,
      group: opts.group ?? null,
    };
    if (toast.group) {
      for (const t of this._toasts()) if (t.group === toast.group) this.dismiss(t.id);
    }
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
