import { Injectable, computed, inject, signal } from '@angular/core';
import {
  BEHAVIOR_LABELS,
  EOD_STATUS_LABELS,
  EOD_TAG_LABELS,
  REASON_LABELS,
  SPRINT_NUMBERS,
  STATUS_LABELS,
  absenceStreak,
  addDays,
  apprenticeDisplayName,
  assessHealth,
  behindStreak,
  cohortWeeks,
  isBehind,
  isFlaggedRating,
  phaseTwoReadiness,
  sprintAverage,
  summarizeAttendance,
  tallyAttendance,
  tallyEod,
  workingDaysBetween,
  type Apprentice,
  type AttendanceRecord,
  type AttendanceSummary,
  type BehaviorRating,
  type EodPacingRecord,
  type EodTally,
  type HealthAssessment,
  type Id,
  type IsoDate,
  type PhaseTwoReadiness,
  type Specialization,
  type SprintMark,
  type WeeklyBehaviorRecord,
} from '../../domain';
import { ApprenticeRepository } from '../../data/ports/apprentice.repository';
import { AttendanceRepository } from '../../data/ports/attendance.repository';
import { BehaviorRepository } from '../../data/ports/behavior.repository';
import { EodRepository } from '../../data/ports/eod.repository';
import { SprintRepository } from '../../data/ports/sprint.repository';
import { ToastService } from '../../shared/components/toast/toast.service';
import { copyText } from '../../shared/utils/clipboard.util';
import { streamFor } from '../../shared/utils/stream-for.util';
import { Clock } from '../platform/clock.service';
import { CohortContextStore } from './cohort-context.store';
import { buildOneOnOneBrief } from './one-on-one-brief.util';
import { ReferenceDataStore } from './reference-data.store';

/** Behavior trajectory length (W1 → W4 of the most recent cohort weeks). */
const TRAJECTORY_WEEKS = 4;
/** "Recent" EOD window for dip detection = the last N working days. */
const RECENT_WORKING_DAYS = 5;

export interface TrajectoryPoint {
  readonly week: number;
  readonly rating: BehaviorRating | null;
}

/** One apprentice's live health: raw tallies + the pure `assessHealth` verdict + Phase 2 data. */
export interface ApprenticeHealth {
  readonly id: Id;
  readonly apprentice: Apprentice;
  readonly name: string;
  readonly specialization: Specialization | undefined;
  readonly coachName: string | null;
  readonly attendance: AttendanceSummary;
  readonly eod: EodTally;
  readonly health: HealthAssessment;
  readonly trajectory: readonly TrajectoryPoint[];
  readonly readiness: PhaseTwoReadiness;
  /** Index 0–3 = Sprint 1–4 (`null` = not marked yet). */
  readonly sprints: readonly (SprintMark | null)[];
  readonly sprintAverage: number | null;
}

export type TimelineKind = 'ATTENDANCE' | 'EOD' | 'BEHAVIOR' | 'SPRINT';

export interface TimelineItem {
  readonly key: string;
  readonly date: IsoDate;
  readonly kind: TimelineKind;
  readonly title: string;
  readonly detail: string | null;
  /** Visual severity of the dot. */
  readonly tone: 'good' | 'warn' | 'bad' | 'neutral';
}

export interface Passport {
  readonly entry: ApprenticeHealth;
  readonly timeline: readonly TimelineItem[];
}

/**
 * Active cohort's per-apprentice health read model + the 360° passport, shared by every screen that shows them
 * (Dashboard, Apprentices). Not root-provided: each page provides it, so its streams live only while the page does.
 * All scoring is delegated to `domain/rules/health-score.rules`.
 */
@Injectable()
export class CohortHealthStore {
  private readonly ctx = inject(CohortContextStore);
  private readonly refs = inject(ReferenceDataStore);
  private readonly clock = inject(Clock);
  private readonly apprenticeRepo = inject(ApprenticeRepository);
  private readonly attendanceRepo = inject(AttendanceRepository);
  private readonly eodRepo = inject(EodRepository);
  private readonly behaviorRepo = inject(BehaviorRepository);
  private readonly sprintRepo = inject(SprintRepository);
  private readonly toasts = inject(ToastService);

  readonly cohort = this.ctx.activeCohort;
  readonly today = this.clock.today;

  // ── Sources ────────────────────────────────────────────────────────────────
  private readonly cohortId = computed(() => this.cohort()?.id ?? null);
  readonly apprentices = streamFor(this.cohortId, (id) => this.apprenticeRepo.watchByCohort(id), [] as readonly Apprentice[]);
  readonly attendance = streamFor(this.cohortId, (id) => this.attendanceRepo.watchByCohort(id), [] as readonly AttendanceRecord[]);
  readonly eodRecords = streamFor(this.cohortId, (id) => this.eodRepo.watchByCohort(id), [] as readonly EodPacingRecord[]);
  private readonly ratings = streamFor(this.cohortId, (id) => this.behaviorRepo.watchByCohort(id), [] as readonly WeeklyBehaviorRecord[]);
  private readonly sprintMarks = streamFor(this.cohortId, (id) => this.sprintRepo.watchByCohort(id), [] as readonly SprintMark[]);

  /** Records grouped per apprentice (O(1) lookups for every derived view). */
  readonly byApprentice = computed(() => ({
    attendance: groupBy(this.attendance()),
    eod: groupBy(this.eodRecords()),
    ratings: groupBy(this.ratings()),
    sprints: groupBy(this.sprintMarks()),
  }));

  /** Last {@link TRAJECTORY_WEEKS} Phase 1 weeks up to today. */
  private readonly trajectoryWeeks = computed(() => {
    const c = this.cohort();
    if (!c) return [];
    const until = this.today() < c.phase1EndDate ? this.today() : c.phase1EndDate;
    return cohortWeeks(c, until).slice(-TRAJECTORY_WEEKS);
  });

  private readonly recentDays = computed(() => {
    const c = this.cohort();
    if (!c) return new Set<IsoDate>();
    const today = this.today();
    return new Set(workingDaysBetween(c, addDays(today, -21), today).slice(-RECENT_WORKING_DAYS));
  });

  /** Every non-withdrawn apprentice of the active cohort with their composite health. */
  readonly all = computed<readonly ApprenticeHealth[]>(() => {
    const c = this.cohort();
    if (!c) return [];
    const today = this.today();
    const groups = this.byApprentice();
    const weeks = this.trajectoryWeeks();
    const recent = this.recentDays();
    const specs = this.refs.specializationById();
    const users = this.refs.userById();

    return this.apprentices()
      .filter((a) => a.status !== 'WITHDRAWN')
      .map((a) => {
        const att = groups.attendance.get(a.id) ?? [];
        const eod = groups.eod.get(a.id) ?? [];
        const ratingByWeek = new Map((groups.ratings.get(a.id) ?? []).map((r) => [r.weekStart, r.rating]));
        const sprintBy = new Map((groups.sprints.get(a.id) ?? []).map((m) => [m.sprintNumber, m]));
        const trajectory = weeks.map((w) => ({ week: w.number, rating: ratingByWeek.get(w.start) ?? null }));
        const eodTally = tallyEod(eod);
        const health = assessHealth({
          attendance: tallyAttendance(att),
          eod: eodTally,
          recentEod: tallyEod(eod.filter((r) => recent.has(r.date))),
          behaviorTrend: trajectory.map((t) => t.rating),
          absenceStreak: absenceStreak(new Map(att.map((r) => [r.date, r.status])), today, c),
          behindStreak: behindStreak(new Map(eod.map((r) => [r.date, r.status])), today, c),
        });
        const sprints = SPRINT_NUMBERS.map((n) => sprintBy.get(n) ?? null);
        return {
          id: a.id,
          apprentice: a,
          name: apprenticeDisplayName(a),
          specialization: specs.get(a.specializationId),
          coachName: a.coachId ? (users.get(a.coachId)?.fullName ?? null) : null,
          attendance: summarizeAttendance(att),
          eod: eodTally,
          health,
          trajectory,
          readiness: phaseTwoReadiness(health),
          sprints,
          sprintAverage: sprintAverage(sprints.filter((m): m is SprintMark => m !== null)),
        };
      });
  });

  readonly byId = computed(() => new Map(this.all().map((e) => [e.id, e])));

  // ── 360° Passport ─────────────────────────────────────────────────────────
  private readonly passportId = signal<Id | null>(null);

  openPassport(id: Id): void {
    this.passportId.set(id);
  }

  closePassport(): void {
    this.passportId.set(null);
  }

  readonly passport = computed<Passport | null>(() => {
    const id = this.passportId();
    const entry = id ? this.byId().get(id) : undefined;
    return entry ? { entry, timeline: this.timelineFor(entry) } : null;
  });

  async copyBrief(): Promise<void> {
    const p = this.passport();
    const cohort = this.cohort();
    if (!p || !cohort) return;
    const ok = await copyText(buildOneOnOneBrief(p, cohort.displayName, this.today()));
    this.toasts.show(
      ok
        ? { message: `1-on-1 brief for ${p.entry.name} copied`, tone: 'success' }
        : { message: 'Could not copy — your browser blocked clipboard access', tone: 'danger' },
    );
  }

  /** Attendance exceptions, EOD notes/blockers, weekly ratings and sprint marks — newest first. */
  private timelineFor(entry: ApprenticeHealth): TimelineItem[] {
    const groups = this.byApprentice();
    const cohort = this.cohort();
    const weekNumber = new Map(cohort ? cohortWeeks(cohort, this.today()).map((w) => [w.start, w.number]) : []);
    const items: TimelineItem[] = [];

    for (const r of groups.attendance.get(entry.id) ?? []) {
      if (r.status === 'P' && !r.note) continue;
      items.push({
        key: `att:${r.id}`,
        date: r.date,
        kind: 'ATTENDANCE',
        title: [STATUS_LABELS[r.status], r.reason ? REASON_LABELS[r.reason] : null].filter(Boolean).join(' · '),
        detail: r.note,
        tone: r.status === 'A' ? 'bad' : r.status === 'L' ? 'warn' : 'neutral',
      });
    }
    for (const r of groups.eod.get(entry.id) ?? []) {
      if (!isBehind(r.status) && !r.note) continue;
      items.push({
        key: `eod:${r.id}`,
        date: r.date,
        kind: 'EOD',
        title: [EOD_STATUS_LABELS[r.status], r.tag ? EOD_TAG_LABELS[r.tag] : null].filter(Boolean).join(' · '),
        detail: r.note,
        tone: r.status === 'BLOCKED' ? 'bad' : r.status === 'NEEDS_SUPPORT' ? 'warn' : 'good',
      });
    }
    for (const r of groups.ratings.get(entry.id) ?? []) {
      const week = weekNumber.get(r.weekStart);
      items.push({
        key: `beh:${r.id}`,
        date: r.weekStart,
        kind: 'BEHAVIOR',
        title: `${week ? `Week ${week} · ` : ''}${r.rating} ${BEHAVIOR_LABELS[r.rating]}`,
        detail: r.note,
        tone: r.rating === '-L' ? 'bad' : isFlaggedRating(r.rating) ? 'warn' : 'good',
      });
    }
    for (const m of groups.sprints.get(entry.id) ?? []) {
      items.push({
        key: `spr:${m.id}`,
        date: m.recordedAt.slice(0, 10) as IsoDate,
        kind: 'SPRINT',
        title: `Sprint ${m.sprintNumber} · ${m.projectName} · ${m.score}/100`,
        detail: m.deliverableSummary,
        tone: m.score >= 85 ? 'good' : m.score >= 70 ? 'neutral' : 'warn',
      });
    }
    return items.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
  }
}

function groupBy<T extends { readonly apprenticeId: Id }>(rows: readonly T[]): Map<Id, T[]> {
  const map = new Map<Id, T[]>();
  for (const r of rows) {
    const list = map.get(r.apprenticeId);
    if (list) list.push(r);
    else map.set(r.apprenticeId, [r]);
  }
  return map;
}
