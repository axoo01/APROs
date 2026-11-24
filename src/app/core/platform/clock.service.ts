import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';
import { toIsoDate, type IsoDate } from '../../domain';

/** Time source. Inject this instead of calling `new Date()` so time-based logic is testable. */
export abstract class Clock {
  abstract now(): Date;
  /** Local calendar date; updates automatically across midnight. */
  abstract readonly today: Signal<IsoDate>;
}

@Injectable()
export class SystemClock extends Clock {
  private readonly _today = signal(toIsoDate(new Date()));
  readonly today = this._today.asReadonly();

  constructor() {
    super();
    // Cheap rollover check; the signal only notifies when the date actually changes.
    const handle = setInterval(() => this._today.set(toIsoDate(new Date())), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(handle));
  }

  now(): Date {
    return new Date();
  }
}

/** Deterministic clock for tests and storybook-style previews. */
export class FixedClock extends Clock {
  private readonly _today: ReturnType<typeof signal<IsoDate>>;
  readonly today: Signal<IsoDate>;

  constructor(private current: Date) {
    super();
    this._today = signal(toIsoDate(current));
    this.today = this._today.asReadonly();
  }

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date): void {
    this.current = date;
    this._today.set(toIsoDate(date));
  }
}
