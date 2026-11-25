import { formatDate } from '@angular/common';
import { Injectable, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, map, type Observable } from 'rxjs';
import {
  REASON_LABELS,
  STATUS_LABELS,
  apprenticeDisplayName,
  attendanceId,
  can,
  needsFollowUp,
  nextWorkingDay,
  previousWorkingDay,
  priorLogWindow,
  resolveLogWindow,
  summarizeAttendance,
  workingDaysBetween,
  type Apprentice,
  type AttendanceMark,
  type AttendanceRecord,
  type AttendanceSummary,
  type DateWindow,
  type Id,
  type IsoDate,
  type LogPreset,
  type Specialization,
} from '../../../domain';
import { AuthService } from '../../../core/auth/auth.service';
import { Clock } from '../../../core/platform/clock.service';
import { CohortContextStore } from '../../../core/state/cohort-context.store';
import { ReferenceDataStore } from '../../../core/state/reference-data.store';
import { ApprenticeRepository } from '../../../data/ports/apprentice.repository';
import { AttendanceRepository } from '../../../data/ports/attendance.repository';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { toCsv } from '../../../shared/utils/csv.util';
import { errorMessage } from '../../../shared/utils/error-message.util';
import { streamFor } from '../../../shared/utils/stream-for.util';
import type { MarkTarget } from '../components/status-drawer/status-drawer.component';
import type { SpecializationChip } from '../components/sweep-filter-bar/sweep-filter-bar.component';
import { describeScope, inRosterScope, matchesSearch, type CoachFilter, type SpecFilter } from './roster-scope.util';

const SEARCH_DEBOUNCE_MS = 150;

export interface LogCell {
  readonly date: IsoDate;
  readonly record: AttendanceRecord | null;
  /** Display name of whoever recorded the mark. */
  readonly recorder: string | null;
}

export interface LogRow {
  readonly id: Id;
  readonly apprentice: Apprentice;
  readonly name: string;
  readonly specialization: Specialization | undefined;
  readonly coachName: string | null;
  readonly cells: readonly LogCell[];
  readonly summary: AttendanceSummary;
  readonly followUp: boolean;
}

export interface LogGroup {
  readonly specialization: Specialization | undefined;
  readonly rows: readonly LogRow[];
  readonly summary: AttendanceSummary;
}

export interface Kpi {
  readonly value: number;
  /** Change vs the prior period (rates in percentage points × 100); null when the prior period has no data. */
  readonly delta: number | null;
}

export interface LogKpis {
  readonly hasData: boolean;
  readonly attendance: Kpi;
  readonly punctuality: Kpi;
  readonly absences: Kpi;
  readonly followUp: Kpi;
}

const PRIOR_LABEL: Readonly<Record<LogPreset, string>> = {
  THIS_WEEK: 'vs same days last week',
  LAST_WEEK: 'vs the week before',
  LAST_30_DAYS: 'vs previous 30 days',
  DAY: 'vs previous working day',
};

const recordsOf = (cells: readonly LogCell[]) => cells.flatMap((c) => (c.record ? [c.record] : []));

/**
 * Past days & trends for the active cohort: date window presets, scoped KPIs with prior-period deltas,
 * a matrix / single-day read model, retroactive edits (undoable) and CSV export.
 */
@Injectable()
export class AttendanceLogFacade {
  private readonly ctx = inject(CohortContextStore);
  private readonly refs = inject(ReferenceDataStore);
  private readonly auth = inject(AuthService);
  private readonly clock = inject(Clock);
  private readonly locale = inject(LOCALE_ID);
  private readonly apprenticeRepo = inject(ApprenticeRepository);
  private readonly attendanceRepo = inject(AttendanceRepository);
  private readonly toasts = inject(ToastService);

  readonly cohort = this.ctx.activeCohort;
  readonly today = this.clock.today;
  readonly canExport = computed(() => can(this.auth.role(), 'data.export'));

  // ── Filters ────────────────────────────────────────────────────────────────
  readonly preset = signal<LogPreset>('THIS_WEEK');
  private readonly pickedDay = signal<IsoDate | null>(null);
  readonly specFilter = signal<SpecFilter>('ALL');
  readonly coachFilter = signal<CoachFilter>('ALL');
  readonly followUpOnly = signal(false);
  readonly searchText = signal('');
  private readonly search$ = new Subject<string>();
  private readonly searchTerm = toSignal(
    this.search$.pipe(
      map((q) => q.trim().toLowerCase()),
      debounceTime(SEARCH_DEBOUNCE_MS),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  // ── Sources ────────────────────────────────────────────────────────────────
  private readonly cohortId = computed(() => this.cohort()?.id ?? null);
  private readonly apprentices = streamFor(
    this.cohortId,
    (id) => this.apprenticeRepo.watchByCohort(id),
    [] as readonly Apprentice[],
  );
  private readonly history = streamFor(
    this.cohortId,
    (id) => this.attendanceRepo.watchByCohort(id),
    [] as readonly AttendanceRecord[],
  );
  private readonly recordById = computed(() => new Map(this.history().map((r) => [r.id, r])));

  // ── Window ─────────────────────────────────────────────────────────────────
  /** Earliest selectable day: the cohort's first day. */
  readonly minDay = computed(() => this.cohort()?.phase1StartDate ?? this.today());
  /** Single-day default: the last working day before today (yesterday's sweep, usually). */
  readonly day = computed(() => {
    const picked = this.pickedDay();
    if (picked) return picked;
    const c = this.cohort();
    const prev = c ? previousWorkingDay(c, this.today()) : this.today();
    return prev < this.minDay() ? this.minDay() : prev;
  });
  readonly isDayView = computed(() => this.preset() === 'DAY');
  readonly window = computed(() => resolveLogWindow(this.preset(), this.today(), this.day()));
  readonly days = computed(() => this.workingDays(this.window()));
  private readonly priorDays = computed(() => {
    const c = this.cohort();
    return c ? this.workingDays(priorLogWindow(this.preset(), this.window(), c)) : [];
  });
  readonly priorLabel = computed(() => PRIOR_LABEL[this.preset()]);

  // ── Rows ───────────────────────────────────────────────────────────────────
  /** Active apprentices in coach scope (spec applied later so chips can count every specialization). */
  private readonly people = computed(() => {
    const specs = this.refs.specializationById();
    const users = this.refs.userById();
    const scope = { spec: 'ALL' as const, coach: this.coachFilter(), me: this.refs.currentUser()?.id ?? null };
    return this.apprentices()
      .filter((a) => a.status === 'ACTIVE' && inRosterScope(a, scope))
      .map((a) => ({
        id: a.id,
        apprentice: a,
        name: apprenticeDisplayName(a),
        specialization: specs.get(a.specializationId),
        coachName: a.coachId ? (users.get(a.coachId)?.fullName ?? null) : null,
      }))
      .sort((x, y) => x.name.localeCompare(y.name));
  });

  private readonly coachScopeRows = computed<readonly LogRow[]>(() => {
    const days = this.days();
    const byId = this.recordById();
    const users = this.refs.userById();
    return this.people().map((p) => {
      const cells = days.map((date) => {
        const record = byId.get(attendanceId(p.id, date)) ?? null;
        return { date, record, recorder: record ? (users.get(record.recordedBy)?.fullName ?? null) : null };
      });
      const summary = summarizeAttendance(recordsOf(cells));
      return { ...p, cells, summary, followUp: needsFollowUp(summary) };
    });
  });

  /** Spec + coach scope — what the KPIs describe (search and "follow-up only" are view filters). */
  private readonly scopeRows = computed(() => {
    const spec = this.specFilter();
    return spec === 'ALL'
      ? this.coachScopeRows()
      : this.coachScopeRows().filter((r) => r.apprentice.specializationId === spec);
  });

  readonly visibleRows = computed(() => {
    const term = this.searchTerm();
    const followUpOnly = this.followUpOnly();
    return this.scopeRows().filter(
      (r) => (!followUpOnly || r.followUp) && matchesSearch(term, r.name, r.apprentice.email),
    );
  });

  readonly groups = computed<readonly LogGroup[]>(() => {
    const byGroup = new Map<string, LogRow[]>();
    for (const r of this.visibleRows()) {
      const key = r.specialization?.id ?? '';
      const list = byGroup.get(key);
      if (list) list.push(r);
      else byGroup.set(key, [r]);
    }
    return [...byGroup.values()]
      .map((rows) => ({
        specialization: rows[0]?.specialization,
        rows,
        summary: summarizeAttendance(rows.flatMap((r) => recordsOf(r.cells))),
      }))
      .sort((a, b) => (a.specialization?.name ?? '~').localeCompare(b.specialization?.name ?? '~'));
  });

  readonly rowById = computed(() => new Map(this.coachScopeRows().map((r) => [r.id, r])));

  readonly chips = computed<readonly SpecializationChip[]>(() => {
    const groups = new Map<Id, { specialization: Specialization; followUp: number }>();
    for (const r of this.coachScopeRows()) {
      if (!r.specialization) continue;
      const g = groups.get(r.specialization.id) ?? { specialization: r.specialization, followUp: 0 };
      groups.set(r.specialization.id, { ...g, followUp: g.followUp + (r.followUp ? 1 : 0) });
    }
    return [...groups.values()]
      .sort((a, b) => a.specialization.name.localeCompare(b.specialization.name))
      .map((g) => ({
        specialization: g.specialization,
        badge: g.followUp > 0 ? g.followUp : null,
        done: false,
        hint: `${g.followUp} need follow-up`,
      }));
  });

  // ── KPIs ───────────────────────────────────────────────────────────────────
  readonly summary = computed(() => summarizeAttendance(this.scopeRows().flatMap((r) => recordsOf(r.cells))));

  readonly kpis = computed<LogKpis>(() => {
    const s = this.summary();
    const rows = this.scopeRows();
    const ids = new Set(rows.map((r) => r.id));
    const byId = this.recordById();

    const priorPerApprentice = new Map<Id, AttendanceRecord[]>();
    for (const date of this.priorDays()) {
      for (const id of ids) {
        const r = byId.get(attendanceId(id, date));
        if (!r) continue;
        const list = priorPerApprentice.get(id);
        if (list) list.push(r);
        else priorPerApprentice.set(id, [r]);
      }
    }
    const prior = summarizeAttendance([...priorPerApprentice.values()].flat());
    const priorFollowUp = [...priorPerApprentice.values()].filter((recs) => needsFollowUp(summarizeAttendance(recs))).length;
    const followUp = rows.filter((r) => r.followUp).length;
    const hasPrior = prior.total > 0;

    return {
      hasData: s.total > 0,
      attendance: { value: s.attendanceRate, delta: hasPrior ? s.attendanceRate - prior.attendanceRate : null },
      punctuality: { value: s.punctualityRate, delta: hasPrior ? s.punctualityRate - prior.punctualityRate : null },
      absences: { value: s.A, delta: hasPrior ? s.A - prior.A : null },
      followUp: { value: followUp, delta: hasPrior ? followUp - priorFollowUp : null },
    };
  });

  readonly scopeLabel = computed(() => {
    const spec = this.specFilter();
    const specName = spec === 'ALL' ? null : (this.refs.specializationById().get(spec)?.name ?? null);
    return describeScope(specName, this.coachFilter());
  });

  // ── Filter commands ────────────────────────────────────────────────────────
  setSearch(text: string): void {
    this.searchText.set(text);
    this.search$.next(text);
  }

  setPreset(preset: LogPreset): void {
    this.preset.set(preset);
  }

  setDay(day: IsoDate): void {
    const clamped = day < this.minDay() ? this.minDay() : day > this.today() ? this.today() : day;
    this.pickedDay.set(clamped);
    this.preset.set('DAY');
  }

  /** Previous / next working day in single-day view, bounded by the cohort start and today. */
  stepDay(direction: -1 | 1): void {
    const c = this.cohort();
    if (!c) return;
    const d = direction < 0 ? previousWorkingDay(c, this.day()) : nextWorkingDay(c, this.day());
    if (d >= this.minDay() && d <= this.today()) this.setDay(d);
  }

  // ── Edits ──────────────────────────────────────────────────────────────────
  /** Drawer subject for one apprentice on one day. */
  target(apprenticeId: Id, date: IsoDate): MarkTarget | null {
    const row = this.rowById().get(apprenticeId);
    if (!row) return null;
    const r = this.recordById().get(attendanceId(apprenticeId, date));
    return {
      id: row.id,
      name: row.name,
      apprentice: row.apprentice,
      specialization: row.specialization,
      coachName: row.coachName,
      mark: r ? { status: r.status, reason: r.reason, note: r.note } : null,
      dateLabel: formatDate(date, 'EEE, d MMM', this.locale),
    };
  }

  setMark(apprenticeId: Id, date: IsoDate, next: AttendanceMark | null): void {
    const row = this.rowById().get(apprenticeId);
    const current = this.recordById().get(attendanceId(apprenticeId, date));
    const previous: AttendanceMark | null = current
      ? { status: current.status, reason: current.reason, note: current.note }
      : null;
    if (!row || (!previous && !next)) return;

    const dateLabel = formatDate(date, 'EEE d MMM', this.locale);
    const label = `${row.name} · ${dateLabel} → ${next ? STATUS_LABELS[next.status] : 'cleared'}`;
    this.run(this.write(apprenticeId, date, next), () =>
      this.toasts.show({
        tone: 'success',
        message: label,
        action: { label: 'Undo', run: () => this.run(this.write(apprenticeId, date, previous), () => undefined) },
      }),
    );
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  /** Long-format CSV (one row per apprentice per working day) of exactly what's visible. */
  exportCsv(): { filename: string; content: string; rows: number } | null {
    const cohort = this.cohort();
    const days = this.days();
    if (!cohort || !days.length) return null;
    const header = [
      'Date', 'Apprentice', 'Email', 'Specialization', 'Coach', 'Status', 'Status label',
      'Reason', 'Note', 'Recorded by', 'Recorded at',
    ];
    const body = this.visibleRows().flatMap((row) =>
      row.cells.map((c) => [
        c.date,
        row.name,
        row.apprentice.email,
        row.specialization?.name ?? '',
        row.coachName ?? 'Unassigned',
        c.record?.status ?? '',
        c.record ? STATUS_LABELS[c.record.status] : 'No record',
        c.record?.reason ? REASON_LABELS[c.record.reason] : '',
        c.record?.note ?? '',
        c.recorder ?? '',
        c.record?.recordedAt ?? '',
      ]),
    );
    const range = days.length === 1 ? days[0] : `${days[0]}_${days[days.length - 1]}`;
    return { filename: `attendance_${cohort.code}_${range}.csv`, content: toCsv([header, ...body]), rows: body.length };
  }

  // ── Internals ──────────────────────────────────────────────────────────────
  private workingDays(w: DateWindow): IsoDate[] {
    const c = this.cohort();
    if (!c) return [];
    const start = w.start < c.phase1StartDate ? c.phase1StartDate : w.start;
    const end = w.end > this.today() ? this.today() : w.end;
    return start > end ? [] : workingDaysBetween(c, start, end);
  }

  private write(apprenticeId: Id, date: IsoDate, mark: AttendanceMark | null): Observable<unknown> {
    return mark
      ? this.attendanceRepo.upsert({ apprenticeId, date, ...mark })
      : this.attendanceRepo.clear(apprenticeId, date);
  }

  private run(command: Observable<unknown>, onDone: () => void): void {
    command.subscribe({
      next: onDone,
      error: (err: unknown) => this.toasts.show({ tone: 'danger', message: errorMessage(err) }),
    });
  }
}
