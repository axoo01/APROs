import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  Observable,
  debounceTime,
  defer,
  distinctUntilChanged,
  filter,
  fromEvent,
  map,
  of,
  skip,
  switchMap,
  timer,
} from 'rxjs';
import { APP_CONFIG } from '../../core/config/app-config.token';
import { Clock } from '../../core/platform/clock.service';
import { KeyValueStorage } from '../../core/platform/key-value-storage.service';
import { DB_STORAGE_KEY, type DbSchema, type DbTableKey, isDbSchema, migrate } from './db-schema.model';

export type DbInitOutcome = 'loaded' | 'seeded' | 'recovered';

/**
 * Normalized, versioned in-memory store persisted to localStorage.
 * The ONLY class that touches persistence; local repository adapters read/write through it.
 *
 * - Reads: `table$(key)` streams emit synchronously and only when that table's reference changes.
 * - Writes: `write()` applies a pure mutation after simulated latency (mirrors a server round-trip).
 * - Persistence: debounced, skips no-op writes, flushes on `pagehide`, syncs across tabs.
 */
@Injectable()
export class LocalDbService {
  private readonly storage = inject(KeyValueStorage);
  private readonly clock = inject(Clock);
  private readonly config = inject(APP_CONFIG);
  private readonly destroyRef = inject(DestroyRef);

  private readonly state$ = new BehaviorSubject<DbSchema | null>(null);
  private lastPersisted: string | null = null;
  private wired = false;

  /** Outcome of the last init/reset, for UX messaging. */
  readonly initOutcome = signal<DbInitOutcome | null>(null);

  async init(): Promise<DbInitOutcome> {
    const raw = this.storage.getItem(DB_STORAGE_KEY);
    const loaded = raw ? this.parse(raw) : null;
    let outcome: DbInitOutcome;
    if (loaded) {
      this.lastPersisted = raw;
      this.state$.next(loaded);
      outcome = 'loaded';
    } else {
      this.state$.next(await this.buildSeed());
      this.persistNow();
      outcome = raw ? 'recovered' : 'seeded';
    }
    this.wirePersistence();
    this.initOutcome.set(outcome);
    return outcome;
  }

  /** Discards all local changes and restores the pre-seeded demo dataset. */
  async resetToSeed(): Promise<void> {
    this.state$.next(await this.buildSeed());
    this.persistNow();
    this.initOutcome.set('seeded');
  }

  snapshot(): DbSchema {
    const db = this.state$.value;
    if (!db) throw new Error('LocalDbService used before init(). Is provideDataLayer() registered?');
    return db;
  }

  table$<K extends DbTableKey>(key: K): Observable<DbSchema[K]> {
    return this.state$.pipe(
      filter((db): db is DbSchema => db !== null),
      map((db) => db[key]),
      distinctUntilChanged(),
    );
  }

  /**
   * Runs a pure mutation `(db) => { db, result }` as one atomic commit.
   * Throwing inside the mutation (e.g. ValidationError) errors the Observable and leaves state untouched.
   */
  write<R>(mutation: (db: DbSchema) => { readonly db: DbSchema; readonly result: R }): Observable<R> {
    const latency = this.config.simulatedLatencyMs;
    const gate$ = latency > 0 ? timer(latency) : of(0);
    return defer(() => gate$).pipe(
      map(() => {
        const { db, result } = mutation(this.snapshot());
        if (db !== this.state$.value) this.state$.next(db);
        return result;
      }),
    );
  }

  private async buildSeed(): Promise<DbSchema> {
    // Lazy chunk: the seed generator (names, history) never ships in the main bundle.
    const { createSeedDb } = await import('../seed/seed-db.factory');
    return createSeedDb(this.clock.now());
  }

  private parse(raw: string): DbSchema | null {
    try {
      const value: unknown = JSON.parse(raw);
      return isDbSchema(value) ? migrate(value) : null;
    } catch {
      return null;
    }
  }

  private persistNow(): void {
    const db = this.state$.value;
    if (!db) return;
    const serialized = JSON.stringify(db);
    if (serialized === this.lastPersisted) return;
    this.storage.setItem(DB_STORAGE_KEY, serialized);
    this.lastPersisted = serialized;
  }

  private wirePersistence(): void {
    if (this.wired) return;
    this.wired = true;

    this.state$
      .pipe(skip(1), debounceTime(this.config.persistDebounceMs), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.persistNow());

    if (typeof window === 'undefined') return;

    fromEvent(window, 'pagehide')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.persistNow());

    // Another tab committed a change: adopt it without echoing a write back.
    fromEvent<StorageEvent>(window, 'storage')
      .pipe(
        filter((e) => e.key === DB_STORAGE_KEY),
        switchMap(async (e) => {
          if (e.newValue === null) return this.buildSeed().then((db) => ({ db, raw: null }));
          const db = this.parse(e.newValue);
          return db ? { db, raw: e.newValue } : null;
        }),
        filter((x): x is { db: DbSchema; raw: string | null } => x !== null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ db, raw }) => {
        this.lastPersisted = raw;
        this.state$.next(db);
      });
  }
}
