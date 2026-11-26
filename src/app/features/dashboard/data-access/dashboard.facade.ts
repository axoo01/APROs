import { Injectable, computed, inject, signal } from '@angular/core';
import {
  EOD_TAG_LABELS,
  SPRINT_NUMBERS,
  can,
  isFlaggedRating,
  isPositiveRating,
  onPaceRate,
  sprintAverage,
  startOfWeek,
  summarizeAttendance,
  systemicBlockers,
  tallyEod,
  type AttendanceSummary,
  type EodTag,
  type EodTally,
  type Id,
  type Specialization,
  type UpsertSprintInput,
} from '../../../domain';
import { AuthService } from '../../../core/auth/auth.service';
import { CohortContextStore } from '../../../core/state/cohort-context.store';
import { CohortHealthStore, type ApprenticeHealth } from '../../../core/state/cohort-health.store';
import { ReferenceDataStore } from '../../../core/state/reference-data.store';
import { SprintRepository } from '../../../data/ports/sprint.repository';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { errorMessage } from '../../../shared/utils/error-message.util';

const STANDOUT_COUNT = 3;

/** KPI card toggles: Health → thriving list · Attendance / EOD → rank worst first · Risk → every flag. */
export type DashboardFocus = 'HEALTH' | 'ATTENDANCE' | 'EOD' | 'RISK';

export interface SpecializationHealth {
  readonly specialization: Specialization;
  readonly headcount: number;
  readonly attendance: AttendanceSummary;
  /** `null` when no EOD is logged for the track. */
  readonly onPace: number | null;
  readonly positive: number;
  readonly flagged: number;
  readonly averageScore: number;
  readonly atRisk: number;
}

/** Target of a "View all" link (router path + query params). */
export interface ViewAllLink {
  readonly path: string;
  readonly query: Readonly<Record<string, string>> | null;
}

export interface BlockerCallout {
  readonly tag: EodTag;
  readonly label: string;
  readonly names: readonly string[];
}

export interface DashboardKpis {
  readonly total: number;
  readonly thriving: number;
  readonly thrivingRate: number;
  readonly attendance: AttendanceSummary;
  readonly hasAttendance: boolean;
  readonly eod: EodTally;
  readonly onPace: number;
  readonly atRisk: number;
  readonly watchlist: number;
}

const TIER_ORDER = { AT_RISK: 0, WATCHLIST: 1, THRIVING: 2 } as const;
const byName = (a: ApprenticeHealth, b: ApprenticeHealth) => a.name.localeCompare(b.name);

/**
 * Master Dashboard views over the shared {@link CohortHealthStore}: KPIs, standouts, early-warning radar,
 * systemic blockers, specialization matrix and (Phase 2 / completed cohorts) sprint delivery.
 */
@Injectable()
export class DashboardFacade {
  private readonly ctx = inject(CohortContextStore);
  private readonly refs = inject(ReferenceDataStore);
  private readonly auth = inject(AuthService);
  private readonly health = inject(CohortHealthStore);
  private readonly sprintRepo = inject(SprintRepository);
  private readonly toasts = inject(ToastService);

  readonly cohort = this.ctx.activeCohort;
  readonly phase = this.ctx.activePhase;
  readonly phaseLabel = this.ctx.activePhaseLabel;
  readonly sprintNumbers = SPRINT_NUMBERS;

  /** Phase 2 and completed cohorts also show sprint delivery. */
  readonly showSprints = computed(() => {
    const kind = this.phase()?.kind;
    return kind === 'PHASE_2' || kind === 'COMPLETED';
  });
  readonly canLogSprint = computed(() => can(this.auth.role(), 'sprint.record'));

  // ── Passport (shared store) ──
  readonly passport = this.health.passport;
  readonly openPassport = (id: Id) => this.health.openPassport(id);
  readonly closePassport = () => this.health.closePassport();
  readonly copyBrief = () => this.health.copyBrief();

  // ── Filters ────────────────────────────────────────────────────────────────
  readonly specFilter = signal<Id | null>(null);
  readonly focus = signal<DashboardFocus | null>(null);

  toggleSpec(id: Id): void {
    this.specFilter.update((cur) => (cur === id ? null : id));
  }

  toggleFocus(f: DashboardFocus): void {
    this.focus.update((cur) => (cur === f ? null : f));
  }

  readonly specFilterName = computed(() => {
    const id = this.specFilter();
    return id ? (this.refs.specializationById().get(id)?.name ?? null) : null;
  });

  readonly scoped = computed(() => {
    const spec = this.specFilter();
    const all = this.health.all();
    return spec ? all.filter((e) => e.apprentice.specializationId === spec) : all;
  });

  private readonly scopedIds = computed(() => new Set(this.scoped().map((e) => e.id)));

  // ── KPIs ───────────────────────────────────────────────────────────────────
  readonly kpis = computed<DashboardKpis>(() => {
    const list = this.scoped();
    const ids = this.scopedIds();
    const attendance = summarizeAttendance(this.health.attendance().filter((r) => ids.has(r.apprenticeId)));
    const eod = tallyEod(this.health.eodRecords().filter((r) => ids.has(r.apprenticeId)));
    const thriving = list.filter((e) => e.health.tier === 'THRIVING').length;
    return {
      total: list.length,
      thriving,
      thrivingRate: list.length ? thriving / list.length : 0,
      attendance,
      hasAttendance: attendance.total > 0,
      eod,
      onPace: onPaceRate(eod),
      atRisk: list.filter((e) => e.health.tier === 'AT_RISK').length,
      watchlist: list.filter((e) => e.health.tier === 'WATCHLIST').length,
    };
  });

  // ── Standouts ─────────────────────────────────────────────────────────────
  readonly standouts = computed(() =>
    [...this.scoped()]
      .sort(
        (a, b) =>
          b.health.score - a.health.score ||
          b.attendance.attendanceRate - a.attendance.attendanceRate ||
          byName(a, b),
      )
      .slice(0, STANDOUT_COUNT),
  );

  // ── Radar ─────────────────────────────────────────────────────────────────
  readonly radar = computed<readonly ApprenticeHealth[]>(() => {
    const list = this.scoped();
    const bySeverity = (a: ApprenticeHealth, b: ApprenticeHealth) =>
      TIER_ORDER[a.health.tier] - TIER_ORDER[b.health.tier] || a.health.score - b.health.score || byName(a, b);
    switch (this.focus()) {
      case 'HEALTH':
        return list.filter((e) => e.health.tier === 'THRIVING').sort((a, b) => b.health.score - a.health.score || byName(a, b));
      case 'ATTENDANCE':
        return [...list].sort(
          (a, b) =>
            a.attendance.attendanceRate - b.attendance.attendanceRate ||
            a.attendance.punctualityRate - b.attendance.punctualityRate ||
            byName(a, b),
        );
      case 'EOD':
        return list.filter((e) => e.eod.total > 0).sort((a, b) => onPaceRate(a.eod) - onPaceRate(b.eod) || byName(a, b));
      case 'RISK':
        return list.filter((e) => e.health.tier !== 'THRIVING').sort(bySeverity);
      default:
        return list.filter((e) => e.health.tier === 'AT_RISK' || e.health.silentDrift).sort(bySeverity);
    }
  });

  /** Where "View all" goes: health lists → Apprentices (filtered), attendance/EOD rankings → their logs. */
  readonly radarViewAll = computed<ViewAllLink>(() => {
    const spec = this.specFilter();
    const apprentices = (view: string): ViewAllLink => ({ path: '/roster', query: spec ? { view, spec } : { view } });
    switch (this.focus()) {
      case 'HEALTH':
        return apprentices('thriving');
      case 'ATTENDANCE':
        return { path: '/attendance/log', query: null };
      case 'EOD':
        return { path: '/coaching/eod/log', query: null };
      case 'RISK':
        return apprentices('flagged');
      default:
        return apprentices('risk');
    }
  });

  readonly radarTitle = computed(() => {
    switch (this.focus()) {
      case 'HEALTH':
        return 'Thriving apprentices';
      case 'ATTENDANCE':
        return 'Attendance · lowest first';
      case 'EOD':
        return 'EOD on pace · lowest first';
      case 'RISK':
        return 'All active risk flags';
      default:
        return 'Silent Drift & Early-Warning Radar';
    }
  });

  /** EOD blocker tags shared by 2+ apprentices this week (Mon → today). */
  readonly blockers = computed<readonly BlockerCallout[]>(() => {
    const ids = this.scopedIds();
    const monday = startOfWeek(this.health.today());
    const byId = this.health.byId();
    return systemicBlockers(this.health.eodRecords().filter((r) => r.date >= monday && ids.has(r.apprenticeId))).map(
      (b) => ({
        tag: b.tag,
        label: EOD_TAG_LABELS[b.tag],
        names: b.apprenticeIds.map((id) => byId.get(id)?.name ?? 'Unknown'),
      }),
    );
  });

  // ── Specialization matrix (always the whole cohort, so any track can be picked) ──
  readonly specMatrix = computed<readonly SpecializationHealth[]>(() => {
    const groups = new Map<Id, ApprenticeHealth[]>();
    for (const e of this.health.all()) {
      const list = groups.get(e.apprentice.specializationId) ?? [];
      list.push(e);
      groups.set(e.apprentice.specializationId, list);
    }
    const { attendance, eod } = this.health.byApprentice();
    return [...groups.values()]
      .filter((list) => list[0]?.specialization)
      .map((list) => {
        const eodTally = tallyEod(list.flatMap((e) => eod.get(e.id) ?? []));
        return {
          specialization: list[0]!.specialization!,
          headcount: list.length,
          attendance: summarizeAttendance(list.flatMap((e) => attendance.get(e.id) ?? [])),
          onPace: eodTally.total ? onPaceRate(eodTally) : null,
          positive: list.filter((e) => isPositiveRating(e.health.latestRating)).length,
          flagged: list.filter((e) => isFlaggedRating(e.health.latestRating)).length,
          averageScore: Math.round(list.reduce((s, e) => s + e.health.score, 0) / list.length),
          atRisk: list.filter((e) => e.health.tier === 'AT_RISK').length,
        };
      })
      .sort((a, b) => a.specialization.name.localeCompare(b.specialization.name));
  });

  // ── Sprint delivery (Phase 2 / completed) ─────────────────────────────────
  readonly sprintRows = computed(() => [...this.scoped()].sort(byName));

  /** Cohort (scoped) average per sprint column. */
  readonly sprintColumnAverages = computed(() =>
    SPRINT_NUMBERS.map((_, i) => sprintAverage(this.scoped().flatMap((e) => (e.sprints[i] ? [e.sprints[i]] : [])))),
  );

  /** Apprentice picker for the sprint dialog. */
  readonly sprintCandidates = computed(() => this.sprintRows().map((e) => ({ id: e.id, name: e.name, sprints: e.sprints })));

  /** Admin-only (the adapter enforces it too, like the API will). Fire-and-forget: the command completes. */
  logSprintMark(input: UpsertSprintInput): void {
    this.sprintRepo.upsert(input).subscribe({
      next: (m) =>
        this.toasts.show({
          message: `Sprint ${m.sprintNumber} logged for ${this.health.byId().get(m.apprenticeId)?.name ?? 'apprentice'}`,
          tone: 'success',
        }),
      error: (err: unknown) => this.toasts.show({ message: errorMessage(err, 'Could not save the sprint mark.'), tone: 'danger' }),
    });
  }
}
