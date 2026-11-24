import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { describePhase, resolveCohortPhase, type Cohort, type Id } from '../../domain';
import { CohortRepository } from '../../data/ports/cohort.repository';
import { Clock } from '../platform/clock.service';
import { KeyValueStorage } from '../platform/key-value-storage.service';

const ACTIVE_COHORT_KEY = 'apros.activeCohortId';

/**
 * The cohort the user is currently working in (top-bar switcher), plus its live phase.
 * Persisted per browser; falls back to the cohort currently in Phase 1, then the newest.
 */
@Injectable({ providedIn: 'root' })
export class CohortContextStore {
  private readonly clock = inject(Clock);
  private readonly storage = inject(KeyValueStorage);

  private readonly allCohorts = toSignal(inject(CohortRepository).watchAll(), { initialValue: [] as readonly Cohort[] });
  private readonly selectedId = signal<Id | null>(this.storage.getItem(ACTIVE_COHORT_KEY));

  /** Non-archived cohorts, newest first. */
  readonly cohorts = computed(() => this.allCohorts().filter((c) => !c.isArchived));

  readonly activeCohort = computed<Cohort | null>(() => {
    const list = this.cohorts();
    const today = this.clock.today();
    return (
      list.find((c) => c.id === this.selectedId()) ??
      list.find((c) => resolveCohortPhase(c, today).kind === 'PHASE_1') ??
      list[0] ??
      null
    );
  });

  readonly activePhase = computed(() => {
    const c = this.activeCohort();
    return c ? resolveCohortPhase(c, this.clock.today()) : null;
  });

  readonly activePhaseLabel = computed(() => {
    const p = this.activePhase();
    return p ? describePhase(p) : '';
  });

  constructor() {
    effect(() => {
      const id = this.selectedId();
      if (id) this.storage.setItem(ACTIVE_COHORT_KEY, id);
    });
  }

  select(id: Id): void {
    this.selectedId.set(id);
  }

  phaseOf(cohort: Cohort) {
    return resolveCohortPhase(cohort, this.clock.today());
  }
}
