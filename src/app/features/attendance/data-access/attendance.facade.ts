import { formatDate } from '@angular/common';
import { DestroyRef, Injectable, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map, type Observable } from 'rxjs';
import {
  STATUS_LABELS,
  apprenticeDisplayName,
  bucketOf,
  checkAttendanceDate,
  detectPattern,
  isNotablePattern,
  summarizeAttendance,
  type Apprentice,
  type AttendancePattern,
  type AttendanceBucket,
  type AttendanceReason,
  type AttendanceRecord,
  type AttendanceStatus,
  type Id,
  type IsoDate,
  type Specialization,
} from '../../../domain';
import { APP_CONFIG } from '../../../core/config/app-config.token';
import { Clock } from '../../../core/platform/clock.service';
import { CohortContextStore } from '../../../core/state/cohort-context.store';
import { ReferenceDataStore } from '../../../core/state/reference-data.store';
import { ApprenticeRepository } from '../../../data/ports/apprentice.repository';
import { AttendanceRepository } from '../../../data/ports/attendance.repository';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { errorMessage } from '../../../shared/utils/error-message.util';
import { streamFor } from '../../../shared/utils/stream-for.util';
import { formatDayReport } from './day-report.util';

/** How long a just-marked card lingers in "Not Here Yet" — a second tap inside this window upgrades P → L. */
export const REVEAL_MS = 650;
const SEARCH_DEBOUNCE_MS = 150;
const UNDO_DEPTH = 20;

export type CoachFilter = 'ALL' | 'MINE' | 'UNASSIGNED';
export type SpecFilter = Id | 'ALL';

/** The mutable part of a day record — what a write sets and what undo restores. */
export interface MarkSnapshot {
  readonly status: AttendanceStatus;
  readonly reason: AttendanceReason | null;
  readonly note: string | null;
}

export interface SweepEntry {
  readonly id: Id;
  readonly apprentice: Apprentice;
  readonly name: string;
  readonly specialization: Specialization | undefined;
  readonly coachName: string | null;
  readonly mark: MarkSnapshot | null;
  readonly bucket: AttendanceBucket;
  /** Marked moments ago; still shown in "Not Here Yet" so a second tap can upgrade it. */
  readonly revealing: boolean;
  /** Recurring-behaviour signals from history (consecutive absences, lates this week). */
  readonly pattern: AttendancePattern;
  readonly notable: boolean;
}

export interface SweepGroup {
  readonly specialization: Specialization | undefined;
  readonly entries: readonly SweepEntry[];
}

/** One apprentice's transition; `null` = no record ("Not Here Yet"). */
interface MarkChange {
  readonly apprenticeId: Id;
  readonly previous: MarkSnapshot | null;
  readonly next: MarkSnapshot | null;
}

export interface ActivityEntry {
  readonly id: number;
  readonly label: string;
  /** Resulting status (`null` = reset to Not Here Yet). */
  readonly status: AttendanceStatus | null;
  readonly changes: readonly MarkChange[];
}

/** Optimistic overlay: shown until the matching write lands (`token` guards against out-of-order completions). */
interface PendingMark {
  readonly token: number;
  readonly mark: MarkSnapshot | null;
}

const PRESENT: MarkSnapshot = { status: 'P', reason: null, note: null };
const LATE: MarkSnapshot = { status: 'L', reason: null, note: null };
const ABSENT: MarkSnapshot = { status: 'A', reason: null, note: null };

const sameMark = (a: MarkSnapshot | null, b: MarkSnapshot | null): boolean =>
  a === b || (!!a && !!b && a.status === b.status && a.reason === b.reason && a.note === b.note);

const snapshotOf = (r: AttendanceRecord | undefined): MarkSnapshot | null =>
  r ? { status: r.status, reason: r.reason, note: r.note } : null;

/**
 * Live Sweep & Reveal read model + commands for today's attendance in the active cohort.
 * Repository streams → signals → computed views. Writes are optimistic, undoable, and validated by the port.
 */
@Injectable()
export class AttendanceFacade {
  private readonly ctx = inject(CohortContextStore);
  private readonly refs = inject(ReferenceDataStore);
  private readonly clock = inject(Clock);
  private readonly config = inject(APP_CONFIG);
  private readonly apprenticeRepo = inject(ApprenticeRepository);
  private readonly attendanceRepo = inject(AttendanceRepository);
  private readonly toasts = inject(ToastService);
  private readonly locale = inject(LOCALE_ID);

  readonly cohort = this.ctx.activeCohort;
  readonly date = this.clock.today;

  // ── Filters ────────────────────────────────────────────────────────────────
  readonly activeBucket = signal<AttendanceBucket>('NOT_HERE_YET');
  readonly specFilter = signal<SpecFilter>('ALL');
  readonly coachFilter = signal<CoachFilter>('ALL');
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
  /** Full cohort history: today's sweep + the pattern badges (streaks, weekly lates). */
  private readonly history = streamFor(
    this.cohortId,
    (id) => this.attendanceRepo.watchByCohort(id),
    [] as readonly AttendanceRecord[],
  );
  private readonly records = computed(() => {
    const today = this.date();
    return this.history().filter((r) => r.date === today);
  });
  /** Past marks per apprentice; today is excluded because it comes from the live (optimistic) overlay. */
  private readonly pastMarks = computed(() => {
    const today = this.date();
    const byApprentice = new Map<Id, Map<IsoDate, AttendanceStatus>>();
    for (const r of this.history()) {
      if (r.date >= today) continue;
      let marks = byApprentice.get(r.apprenticeId);
      if (!marks) byApprentice.set(r.apprenticeId, (marks = new Map()));
      marks.set(r.date, r.status);
    }
    return byApprentice;
  });

  private readonly pending = signal<ReadonlyMap<Id, PendingMark>>(new Map());
  private readonly revealing = signal<ReadonlySet<Id>>(new Set());
  private readonly activity = signal<readonly ActivityEntry[]>([]);
  private readonly revealTimers = new Map<Id, ReturnType<typeof setTimeout>>();
  private seq = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revealTimers.forEach((t) => clearTimeout(t)));
  }

  // ── Views ──────────────────────────────────────────────────────────────────
  readonly dateCheck = computed(() => {
    const c = this.cohort();
    return c ? checkAttendanceDate(c, this.date(), { demoMode: this.config.demoMode }) : null;
  });
  readonly canRecord = computed(() => this.dateCheck()?.allowed ?? false);

  private readonly markById = computed(() => {
    const marks = new Map<Id, MarkSnapshot | null>(this.records().map((r) => [r.apprenticeId, snapshotOf(r)]));
    for (const [id, p] of this.pending()) marks.set(id, p.mark);
    return marks;
  });

  private readonly entries = computed<readonly SweepEntry[]>(() => {
    const specs = this.refs.specializationById();
    const users = this.refs.userById();
    const marks = this.markById();
    const revealing = this.revealing();
    const past = this.pastMarks();
    const today = this.date();
    const calendar = this.cohort() ?? { nonWorkingDays: [] };
    return this.apprentices()
      .filter((a) => a.status === 'ACTIVE')
      .map((a) => {
        const mark = marks.get(a.id) ?? null;
        const history = past.get(a.id);
        const pattern = detectPattern(
          { get: (d) => (d === today ? mark?.status : history?.get(d)) },
          today,
          calendar,
        );
        return {
          id: a.id,
          apprentice: a,
          name: apprenticeDisplayName(a),
          specialization: specs.get(a.specializationId),
          coachName: a.coachId ? (users.get(a.coachId)?.fullName ?? null) : null,
          mark,
          bucket: bucketOf(mark?.status),
          revealing: revealing.has(a.id),
          pattern,
          notable: isNotablePattern(pattern),
        };
      })
      .sort((x, y) => x.name.localeCompare(y.name));
  });

  readonly entryById = computed(() => new Map(this.entries().map((e) => [e.id, e])));

  /** Apprentices in the current specialization + coach scope (search is a view filter, not a scope). */
  readonly scope = computed(() => {
    const spec = this.specFilter();
    const coach = this.coachFilter();
    const me = this.refs.currentUser()?.id ?? null;
    return this.entries().filter(
      (e) =>
        (spec === 'ALL' || e.apprentice.specializationId === spec) &&
        (coach === 'ALL' ||
          (coach === 'MINE' && e.apprentice.coachId !== null && e.apprentice.coachId === me) ||
          (coach === 'UNASSIGNED' && e.apprentice.coachId === null)),
    );
  });

  readonly counts = computed(() => {
    const c: Record<AttendanceBucket, number> = { NOT_HERE_YET: 0, PRESENT: 0, ABSENT_EXCUSED: 0 };
    for (const e of this.scope()) c[e.bucket] += 1;
    return c;
  });

  readonly summary = computed(() =>
    summarizeAttendance(this.scope().flatMap((e) => (e.mark ? [e.mark] : []))),
  );
  readonly remaining = computed(() => this.scope().filter((e) => e.bucket === 'NOT_HERE_YET'));
  readonly total = computed(() => this.scope().length);
  readonly swept = computed(() => this.total() - this.remaining().length);
  readonly progress = computed(() => (this.total() === 0 ? 0 : this.swept() / this.total()));
  readonly isSwept = computed(() => this.total() > 0 && this.remaining().length === 0);
  readonly hasFilters = computed(() => this.specFilter() !== 'ALL' || this.coachFilter() !== 'ALL');

  /** Human label for the active scope, e.g. "Frontend · your group"; null = whole cohort. */
  readonly scopeLabel = computed(() => {
    const parts: string[] = [];
    const spec = this.specFilter();
    if (spec !== 'ALL') {
      const name = this.refs.specializationById().get(spec)?.name;
      if (name) parts.push(name);
    }
    const coach = this.coachFilter();
    if (coach === 'MINE') parts.push('your group');
    if (coach === 'UNASSIGNED') parts.push('unassigned apprentices');
    return parts.length ? parts.join(' · ') : null;
  });

  /** Specialization chips: only those present in the cohort, with live remaining counts. */
  readonly specializationChips = computed(() => {
    const groups = new Map<Id, { specialization: Specialization; total: number; remaining: number }>();
    for (const e of this.entries()) {
      if (!e.specialization) continue;
      const g = groups.get(e.specialization.id) ?? { specialization: e.specialization, total: 0, remaining: 0 };
      groups.set(e.specialization.id, {
        ...g,
        total: g.total + 1,
        remaining: g.remaining + (e.bucket === 'NOT_HERE_YET' ? 1 : 0),
      });
    }
    return [...groups.values()].sort((a, b) => a.specialization.name.localeCompare(b.specialization.name));
  });

  readonly groups = computed<readonly SweepGroup[]>(() => {
    const bucket = this.activeBucket();
    const term = this.searchTerm();
    const visible = this.scope().filter(
      (e) =>
        (e.bucket === bucket || (bucket === 'NOT_HERE_YET' && e.revealing)) &&
        (!term || e.name.toLowerCase().includes(term) || e.apprentice.email.toLowerCase().includes(term)),
    );
    const byGroup = new Map<string, SweepEntry[]>();
    for (const e of visible) {
      const key = e.specialization?.id ?? '';
      const list = byGroup.get(key);
      if (list) list.push(e);
      else byGroup.set(key, [e]);
    }
    return [...byGroup.values()]
      .map((entries) => ({ specialization: entries[0]?.specialization, entries }))
      .sort((a, b) => (a.specialization?.name ?? '~').localeCompare(b.specialization?.name ?? '~'));
  });
  readonly visibleCount = computed(() => this.groups().reduce((n, g) => n + g.entries.length, 0));

  readonly recentActivity = computed(() => this.activity().slice(0, 6));
  readonly canUndo = computed(() => this.activity().length > 0);

  /** Plain-text Absent / Late / Excused report for the current scope (Slack / Teams). */
  dayReport(): string | null {
    const cohort = this.cohort();
    if (!cohort) return null;
    return formatDayReport({
      cohort,
      dateLabel: formatDate(this.date(), 'EEE, d MMM y', this.locale),
      scopeLabel: this.scopeLabel(),
      summary: this.summary(),
      entries: this.scope(),
    });
  }

  // ── Filter commands ────────────────────────────────────────────────────────
  setSearch(text: string): void {
    this.searchText.set(text);
    this.search$.next(text);
  }

  // ── Mark commands ──────────────────────────────────────────────────────────
  /**
   * The sweep gesture. First tap → `P` (card lingers for {@link REVEAL_MS});
   * a second tap inside that window upgrades to `L`, coalesced into the same undo step.
   */
  tap(apprenticeId: Id): void {
    const entry = this.entry(apprenticeId);
    if (!entry) return;

    if (entry.revealing && entry.mark?.status === 'P') {
      if (this.apply([{ apprenticeId, next: LATE }], { coalesce: true })) this.reveal(apprenticeId);
      return;
    }
    if (entry.mark === null) {
      if (this.apply([{ apprenticeId, next: PRESENT }])) this.reveal(apprenticeId);
    }
  }

  /** Explicit status from the drawer or a keyboard shortcut. Validation (E needs a reason) is enforced by the port. */
  setMark(apprenticeId: Id, next: MarkSnapshot): void {
    const entry = this.entry(apprenticeId);
    if (!entry || sameMark(entry.mark, next)) return;
    const wasWaiting = entry.mark === null;
    if (this.apply([{ apprenticeId, next }]) && wasWaiting && this.activeBucket() === 'NOT_HERE_YET') {
      this.reveal(apprenticeId);
    }
  }

  /** Back to "Not Here Yet" (corrections). */
  resetMark(apprenticeId: Id): void {
    if (this.entry(apprenticeId)?.mark) this.apply([{ apprenticeId, next: null }]);
  }

  /** Closeout: everyone still "Not Here Yet" in scope (minus `exclude`) becomes `A` in one atomic write. */
  closeoutRemaining(exclude: ReadonlySet<Id> = new Set()): void {
    const targets = this.remaining().filter((e) => !exclude.has(e.id));
    if (targets.length) this.apply(targets.map((e) => ({ apprenticeId: e.id, next: ABSENT })));
  }

  /** Undo the most recent change (Ctrl/⌘+Z). */
  undoLast(): void {
    const last = this.activity()[0];
    if (last) this.undo(last.id);
  }

  /** Undo a specific change — refused if any apprentice in it was changed again since. */
  undo(activityId: number): void {
    const item = this.activity().find((a) => a.id === activityId);
    if (!item) return;
    this.dropActivity(activityId);
    const marks = this.markById();
    if (item.changes.some((c) => !sameMark(marks.get(c.apprenticeId) ?? null, c.next))) {
      this.toasts.show({ tone: 'warning', message: 'Already changed since — nothing to undo.' });
      return;
    }
    if (this.apply(item.changes.map((c) => ({ apprenticeId: c.apprenticeId, next: c.previous })), { record: false })) {
      this.toasts.show({ message: `Undone: ${item.label}` });
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────
  private entry(id: Id): SweepEntry | undefined {
    return this.entryById().get(id);
  }

  /**
   * Single write path: optimistic overlay → port commands (upsert + clear, each atomic) → settle.
   * Records an undoable activity entry unless `record: false` (undo itself).
   */
  private apply(
    changes: readonly { apprenticeId: Id; next: MarkSnapshot | null }[],
    opts: { coalesce?: boolean; record?: boolean } = {},
  ): boolean {
    if (!this.canRecord() || !changes.length) return false;
    const marks = this.markById();
    const date = this.date();
    const full: MarkChange[] = changes.map((c) => ({
      apprenticeId: c.apprenticeId,
      previous: marks.get(c.apprenticeId) ?? null,
      next: c.next,
    }));

    const upserts = full.flatMap((c) => (c.next ? [{ apprenticeId: c.apprenticeId, date, ...c.next }] : []));
    const clears = full.filter((c) => c.next === null).map((c) => c.apprenticeId);
    const commands: Observable<unknown>[] = [];
    if (upserts.length) commands.push(this.attendanceRepo.upsertMany(upserts));
    if (clears.length) commands.push(this.attendanceRepo.clearMany(clears, date));

    const token = ++this.seq;
    this.pending.update((m) => {
      const next = new Map(m);
      for (const c of full) next.set(c.apprenticeId, { token, mark: c.next });
      return next;
    });
    const settle = () =>
      this.pending.update((m) => {
        const next = new Map(m);
        for (const c of full) if (next.get(c.apprenticeId)?.token === token) next.delete(c.apprenticeId);
        return next;
      });
    forkJoin(commands).subscribe({
      next: settle,
      error: (err: unknown) => {
        settle();
        for (const c of full) this.unreveal(c.apprenticeId);
        this.toasts.show({ tone: 'danger', message: errorMessage(err) });
      },
    });

    if (opts.record !== false) this.record(full, opts.coalesce ?? false);
    return true;
  }

  private record(changes: readonly MarkChange[], coalesce: boolean): void {
    const first = changes[0];
    if (!first) return;
    const status = first.next?.status ?? null;
    const outcome = status ? STATUS_LABELS[status] : 'Not Here Yet';
    const label =
      changes.length === 1
        ? `${this.entry(first.apprenticeId)?.name ?? 'Apprentice'} → ${outcome}`
        : `${changes.length} marked ${outcome}`;

    const last = this.activity()[0];
    const lastChange = last?.changes.length === 1 ? last.changes[0] : undefined;
    if (coalesce && last && lastChange?.apprenticeId === first.apprenticeId) {
      // P → L inside the reveal window: one undo step that returns to the original state.
      this.dropActivity(last.id);
      changes = [{ ...first, previous: lastChange.previous }];
    }
    const id = this.pushActivity({ label, status, changes });
    this.toasts.show({
      tone: status === 'P' || status === 'L' ? 'success' : 'info',
      message: label,
      action: { label: 'Undo', run: () => this.undo(id) },
    });
  }

  private pushActivity(item: Omit<ActivityEntry, 'id'>): number {
    const id = ++this.seq;
    this.activity.update((list) => [{ ...item, id }, ...list].slice(0, UNDO_DEPTH));
    return id;
  }

  private dropActivity(id: number): void {
    this.activity.update((list) => list.filter((a) => a.id !== id));
  }

  private reveal(id: Id): void {
    clearTimeout(this.revealTimers.get(id));
    this.revealing.update((s) => new Set(s).add(id));
    this.revealTimers.set(
      id,
      setTimeout(() => this.unreveal(id), REVEAL_MS),
    );
  }

  private unreveal(id: Id): void {
    clearTimeout(this.revealTimers.get(id));
    this.revealTimers.delete(id);
    if (!this.revealing().has(id)) return;
    this.revealing.update((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  }
}
