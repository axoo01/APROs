import { Injectable, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import {
  HEALTH_THRESHOLDS,
  HEALTH_TIER_LABELS,
  apprenticeDisplayName,
  onPaceRate,
  type Apprentice,
  type Id,
  type Specialization,
} from '../../../domain';
import { CohortContextStore } from '../../../core/state/cohort-context.store';
import { CohortHealthStore, type ApprenticeHealth } from '../../../core/state/cohort-health.store';
import { ReferenceDataStore } from '../../../core/state/reference-data.store';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { toCsv } from '../../../shared/utils/csv.util';
import { downloadFile } from '../../../shared/utils/download.util';

const SEARCH_DEBOUNCE_MS = 150;

/** Sortable directory columns (Track isn't sortable: the chips already filter by it). */
export type ApprenticeSortKey = 'NAME' | 'COACH' | 'VIBE' | 'READINESS';
export type SortDir = 'asc' | 'desc';
export interface ApprenticeSort {
  readonly key: ApprenticeSortKey;
  readonly dir: SortDir;
}
const MAX_DRIVERS = 3;

export interface ApprenticeRow {
  readonly id: Id;
  readonly apprentice: Apprentice;
  readonly name: string;
  readonly specialization: Specialization | undefined;
  readonly coachName: string | null;
  /** `null` for withdrawn apprentices (no live health). */
  readonly health: ApprenticeHealth | null;
}

export interface ReadinessRow {
  readonly entry: ApprenticeHealth;
  /** What drives the verdict: strengths when Ready, concerns when pairing is needed. */
  readonly drivers: readonly string[];
}

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

/** Why someone is (or isn't) Phase 2 ready, in plain words. */
function readinessDrivers(e: ApprenticeHealth): string[] {
  if (e.readiness === 'NEEDS_PAIRING') {
    const reasons = e.health.reasons.slice(0, MAX_DRIVERS);
    return reasons.length ? reasons : [`Composite ${e.health.score} (ready at ${HEALTH_THRESHOLDS.readyScore})`];
  }
  return [
    `Attendance ${pct(e.attendance.attendanceRate)}`,
    ...(e.eod.total ? [`On pace ${pct(onPaceRate(e.eod))}`] : []),
    ...(e.health.latestRating ? [`${e.health.latestRating} behavior`] : []),
  ];
}

/** asc: name A→Z · coach A→Z · vibe = composite score low→high · readiness = Pairing Support first (lowest score first). */
function compareRows(a: ApprenticeRow, b: ApprenticeRow, key: ApprenticeSortKey): number {
  switch (key) {
    case 'NAME':
      return a.name.localeCompare(b.name);
    case 'COACH':
      return (a.coachName ?? '\uffff').localeCompare(b.coachName ?? '\uffff');
    case 'VIBE':
      return (a.health?.health.score ?? 0) - (b.health?.health.score ?? 0);
    case 'READINESS': {
      const rank = (r: ApprenticeRow) => (r.health?.readiness === 'READY' ? 1 : 0);
      return rank(a) - rank(b) || (a.health?.health.score ?? 0) - (b.health?.health.score ?? 0);
    }
  }
}

/**
 * Apprentices directory (route `/roster`): searchable, track-filtered rows with live health pills,
 * the Phase 2 readiness forecast/report (+ CSV) and the shared 360° passport.
 */
@Injectable()
export class ApprenticesFacade {
  private readonly ctx = inject(CohortContextStore);
  private readonly refs = inject(ReferenceDataStore);
  private readonly health = inject(CohortHealthStore);
  private readonly toasts = inject(ToastService);

  readonly cohort = this.ctx.activeCohort;
  readonly specializations = this.refs.specializations;

  /** The forecast only makes sense before Phase 2 starts; Phase 2 / completed cohorts show sprint averages instead. */
  readonly showReadiness = computed(() => {
    const kind = this.ctx.activePhase()?.kind;
    return kind !== 'PHASE_2' && kind !== 'COMPLETED';
  });

  // ── Passport (shared store) ──
  readonly passport = this.health.passport;
  readonly openPassport = (id: Id) => this.health.openPassport(id);
  readonly closePassport = () => this.health.closePassport();
  readonly copyBrief = () => this.health.copyBrief();

  // ── Filters ────────────────────────────────────────────────────────────────
  readonly query = signal('');
  readonly specFilter = signal<Id | null>(null);
  private readonly search = toSignal(
    toObservable(this.query).pipe(
      debounceTime(SEARCH_DEBOUNCE_MS),
      map((q) => q.trim().toLowerCase()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  /** Click a header: same column flips asc ↔ desc, a new column starts ascending. */
  readonly sort = signal<ApprenticeSort>({ key: 'NAME', dir: 'asc' });

  sortBy(key: ApprenticeSortKey): void {
    this.sort.update((cur) => ({ key, dir: cur.key === key && cur.dir === 'asc' ? 'desc' : 'asc' }));
  }

  toggleSpec(id: Id): void {
    this.specFilter.update((cur) => (cur === id ? null : id));
  }

  // ── Directory ─────────────────────────────────────────────────────────────
  private readonly allRows = computed<readonly ApprenticeRow[]>(() => {
    const specs = this.refs.specializationById();
    const users = this.refs.userById();
    const healthById = this.health.byId();
    return this.health
      .apprentices()
      .map((a) => ({
        id: a.id,
        apprentice: a,
        name: apprenticeDisplayName(a),
        specialization: specs.get(a.specializationId),
        coachName: a.coachId ? (users.get(a.coachId)?.fullName ?? null) : null,
        health: healthById.get(a.id) ?? null,
      }))
      .sort((x, y) => x.name.localeCompare(y.name));
  });

  readonly total = computed(() => this.allRows().length);

  readonly rows = computed(() => {
    const q = this.search();
    const spec = this.specFilter();
    const { key, dir } = this.sort();
    const sign = dir === 'asc' ? 1 : -1;
    return this.allRows()
      .filter(
        (r) =>
          (!spec || r.apprentice.specializationId === spec) &&
          (!q || `${r.name} ${r.apprentice.email} ${r.coachName ?? ''}`.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        // Withdrawn apprentices (no live health) always sink to the bottom on health-based columns.
        if ((key === 'VIBE' || key === 'READINESS') && !a.health !== !b.health) return a.health ? -1 : 1;
        return sign * compareRows(a, b, key) || a.name.localeCompare(b.name);
      });
  });

  // ── Phase 2 readiness (follows the track filter, not the search) ──────────
  private readonly readinessScope = computed(() => {
    const spec = this.specFilter();
    const all = this.health.all();
    return spec ? all.filter((e) => e.apprentice.specializationId === spec) : all;
  });

  readonly readiness = computed(() => {
    const scope = this.readinessScope();
    const ready = scope.filter((e) => e.readiness === 'READY');
    return {
      total: scope.length,
      ready: ready.length,
      needsPairing: scope.length - ready.length,
      readyRate: scope.length ? ready.length / scope.length : 0,
    };
  });

  /** Full report: Needs Pairing first (lowest score first), then Ready (highest first). */
  readonly report = computed(() => {
    const scope = this.readinessScope();
    const toRow = (entry: ApprenticeHealth): ReadinessRow => ({ entry, drivers: readinessDrivers(entry) });
    return {
      needsPairing: scope
        .filter((e) => e.readiness === 'NEEDS_PAIRING')
        .sort((a, b) => a.health.score - b.health.score || a.name.localeCompare(b.name))
        .map(toRow),
      ready: scope
        .filter((e) => e.readiness === 'READY')
        .sort((a, b) => b.health.score - a.health.score || a.name.localeCompare(b.name))
        .map(toRow),
    };
  });

  exportReport(): void {
    const cohort = this.cohort();
    if (!cohort) return;
    const { needsPairing, ready } = this.report();
    const rows = [...needsPairing, ...ready];
    const header = [
      'Apprentice',
      'Email',
      'Specialization',
      'Coach',
      'Readiness',
      'Composite score',
      'Health tier',
      'Attendance %',
      'Punctuality %',
      'EOD on-pace %',
      'Latest behavior',
      'Key drivers',
    ];
    const body = rows.map(({ entry: e, drivers }) => [
      e.name,
      e.apprentice.email,
      e.specialization?.name ?? '',
      e.coachName ?? 'Unassigned',
      e.readiness === 'READY' ? 'Ready' : 'Needs Pairing Support',
      e.health.score,
      HEALTH_TIER_LABELS[e.health.tier],
      Math.round(e.attendance.attendanceRate * 100),
      Math.round(e.attendance.punctualityRate * 100),
      e.eod.total ? Math.round(onPaceRate(e.eod) * 100) : '',
      e.health.latestRating ?? '',
      drivers.join('; '),
    ]);
    const track = this.specFilter() ? `_${this.refs.specializationById().get(this.specFilter()!)?.code ?? 'track'}` : '';
    downloadFile(`phase2-readiness_${cohort.code}${track}_${this.health.today()}.csv`, toCsv([header, ...body]));
    this.toasts.show({ message: `Readiness report exported · ${body.length} apprentices`, tone: 'success' });
  }
}
