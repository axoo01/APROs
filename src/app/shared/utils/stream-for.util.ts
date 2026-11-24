import { type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { type Observable, of, switchMap } from 'rxjs';

/**
 * Bridges a signal key (e.g. active cohort id) to a repository stream and back to a signal.
 * Re-subscribes (cancelling the previous stream) whenever the key changes. Must run in an injection context.
 */
export function streamFor<K, T>(key: Signal<K | null>, query: (key: K) => Observable<T>, initial: T): Signal<T> {
  return toSignal(toObservable(key).pipe(switchMap((k) => (k === null ? of(initial) : query(k)))), {
    initialValue: initial,
  });
}
