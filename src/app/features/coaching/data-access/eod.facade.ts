import { DestroyRef, Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map, type Observable } from 'rxjs';
import {
  EOD_STATUS_LABELS,
  apprenticeDisplayName,
  behindStreak,
  checkAttendanceDate,
  tallyEod,
  type Apprentice,
  type AttendanceRecord,
  type AttendanceStatus,
  type EodMark,
  type EodPacingRecord,
  type EodStatus,
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
import { EodRepository } from '../../../data/ports/eod.repository';
import type { SpecializationChip } from '../../../shared/components/roster-filter-bar/roster-filter-bar.component';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { errorMessage } from '../../../shared/utils/error-message.util';
import {
  coachFilterLabel,
  describeScope,
  inRosterScope,
  matchesSearch,
  type CoachFilter,
  type SpecFilter,
} from '../../../shared/utils/roster-scope.util';
import { streamFor } from '../../../shared/utils/stream-for.util';

/** How long a just-rated card lingers in "Not Logged" — a second tap inside it opens the drawer. */
export const EOD_REVEAL_MS = 650;
const SEARCH_DEBOUNCE_MS = 150;
const UNDO_DEPTH = 20;

export type EodBucket = 'NOT_LOGGED' | EodStatus;

/**
 * Where an apprentice sits today, from attendance:
 * `QUEUE` = present (P/L) → rate them · `AWAY` = absent/excused (muted, override allowed) · `NOT_CHECKED_IN` = no attendance yet.
 */
export type EodLane = 'QUEUE' | 'AWAY' | 'NOT_CHECKED_IN';

export interface EodEntry {
  readonly id: Id;
  readonly apprentice: Apprentice;
  readonly name: string;
  readonly specialization: Specialization | undefined;
  readonly coachName: string | null;
  readonly attendance: AttendanceStatus | null;
  readonly lane: EodLane;
  readonly mark: EodMark | null;
  readonly bucket: EodBucket;
  readonly revealing: boolean;
  /** Consecutive Needs Support / Blocked working days ending today (live mark included). */
  readonly behindStreak: number;
}

export interface EodGroup {
  readonly specialization: Specialization | undefined;
  readonly entries: readonly EodEntry[];
}

interface MarkChange {
  readonly apprenticeId: Id;
  readonly previous: EodMark | null;
  readonly next: EodMark | null;
}

const ON_PACE: EodMark = { status: 'ON_PACE', tag: null, note: null };

const sameMark = (a: EodMark | null, b: EodMark | null): boolean =>
  a === b || (!!a && !!b && a.status === b.status && a.tag === b.tag && a.note === b.note);

const laneOf = (status: AttendanceStatus | null): EodLane =>
  status === 'P' || status === 'L' ? 'QUEUE' : status === 'A' || status === 'E' ? 'AWAY' : 'NOT_CHECKED_IN';

function groupBySpecialization(entries: readonly EodEntry[]): EodGroup[] {
  const byGroup = new Map<string, EodEntry[]>();
  for (const e of entries) {
    const key = e.specialization?.id ?? '';
    const list = byGroup.get(key);
    if (list) list.push(e);
    else byGroup.set(key, [e]);
  }
  return [...byGroup.values()]
    .map((list) => ({ specialization: list[0]?.specialization, entries: list }))
    .sort((a, b) => (a.specialization?.name ?? '~').localeCompare(b.specialization?.name ?? '~'));
}

/**
 * Today's EOD pacing ("reverse sweep"): present apprentices form the queue, tap = On Pace,
 * flag the few who are behind, close out the rest. Writes are optimistic and undoable.
 */
@Injectable()
export class EodFacade {
  private readonly ctx = inject(CohortContextStore);
  private readonly refs = inject(ReferenceDataStore);
  private readonly clock = inject(Clock);
  private readonly config = inject(APP_CONFIG);
  private readonly apprenticeRepo = inject(ApprenticeRepository);
  private readonly attendanceRepo = inject(AttendanceRepository);
  private readonly eodRepo = inject(EodRepository);
  private readonly toasts = inject(ToastService);

  readonly cohort = this.ctx.activeCohort;
  readonly date = this.clock.today;
  readonly coaches = this.refs.coachOptions;
  readonly showMine = this.refs.currentUserIsCoach;

  // ── Filters ────────────────────────────────────────────────────────────────
  readonly activeBucket = signal<EodBucket>('NOT_LOGGED');
  readonly specFilter = signal<SpecFilter>('ALL');
  /**
   * Defaults to "Mine" for a coach with assigned apprentices (else "All"). Re-seeds only if that fact changes,
   * so a manual choice (All / another coach) sticks for the session.
   */
  private readonly hasOwnGroup = computed(() => {
    const me = this.refs.currentUser();
    return me?.role === 'COACH' && this.apprentices().some((a) => a.status === 'ACTIVE' && a.coachId === me.id);
  });
  readonly coachFilter = linkedSignal<CoachFilter>(() => (this.hasOwnGroup() ? 'MINE' : 'ALL'));
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
  private readonly cohortDay = computed(() => {
    const id = this.cohortId();
    return id ? { cohortId: id, date: this.date() } : null;
  });
  private readonly apprentices = streamFor(
    this.cohortId,
    (id) => this.apprenticeRepo.watchByCohort(id),
    [] as readonly Apprentice[],
  );
  private readonly attendanceToday = streamFor(
    this.cohortDay,
    (q: { cohortId: Id; date: IsoDate }) => this.attendanceRepo.watchByCohortOnDate(q.cohortId, q.date),
    [] as readonly AttendanceRecord[],
  );
  private readonly history = streamFor(
    this.cohortId,
    (id) => this.eodRepo.watchByCohort(id),
    [] as readonly EodPacingRecord[],
  );

  private readonly pending = signal<ReadonlyMap<Id, { token: number; mark: EodMark | null }>>(new Map());
  private readonly revealing = signal<ReadonlySet<Id>>(new Set());
  private readonly activity = signal<readonly { id: number; label: string; changes: readonly MarkChange[] }[]>([]);
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

  /** Past statuses per apprentice (for streaks); today comes from the live overlay. */
  private readonly pastStatuses = computed(() => {
    const today = this.date();
    const byApprentice = new Map<Id, Map<IsoDate, EodStatus>>();
    for (const r of this.history()) {
      if (r.date >= today) continue;
      let m = byApprentice.get(r.apprenticeId);
      if (!m) byApprentice.set(r.apprenticeId, (m = new Map()));
      m.set(r.date, r.status);
    }
    return byApprentice;
  });

  private readonly markById = computed(() => {
    const today = this.date();
    const marks = new Map<Id, EodMark | null>();
    for (const r of this.history()) {
      if (r.date === today) marks.set(r.apprenticeId, { status: r.status, tag: r.tag, note: r.note });
    }
    for (const [id, p] of this.pending()) marks.set(id, p.mark);
    return marks;
  });

  private readonly entries = computed<readonly EodEntry[]>(() => {
    const specs = this.refs.specializationById();
    const users = this.refs.userById();
    const marks = this.markById();
    const attendance = new Map(this.attendanceToday().map((r) => [r.apprenticeId, r.status]));
    const revealing = this.revealing();
    const past = this.pastStatuses();
    const today = this.date();
    const calendar = this.cohort() ?? { nonWorkingDays: [] };
    return this.apprentices()
      .filter((a) => a.status === 'ACTIVE')
      .map((a): EodEntry => {
        const mark = marks.get(a.id) ?? null;
        const att = attendance.get(a.id) ?? null;
        const history = past.get(a.id);
        return {
          id: a.id,
          apprentice: a,
          name: apprenticeDisplayName(a),
          specialization: specs.get(a.specializationId),
          coachName: a.coachId ? (users.get(a.coachId)?.fullName ?? null) : null,
          attendance: att,
          lane: laneOf(att),
          mark,
          bucket: mark?.status ?? 'NOT_LOGGED',
          revealing: revealing.has(a.id),
          behindStreak: behindStreak({ get: (d) => (d === today ? mark?.status : history?.get(d)) }, today, calendar),
        };
      })
      .sort((x, y) => x.name.localeCompare(y.name));
  });

  readonly entryById = computed(() => new Map(this.entries().map((e) => [e.id, e])));

  /** Specialization + coach scope (search is a view filter). */
  private readonly scope = computed(() => {
    const scope = { spec: this.specFilter(), coach: this.coachFilter(), me: this.refs.currentUser()?.id ?? null };
    return this.entries().filter((e) => inRosterScope(e.apprentice, scope));
  });

  readonly queue = computed(() => this.scope().filter((e) => e.lane === 'QUEUE'));
  readonly remaining = computed(() => this.queue().filter((e) => e.bucket === 'NOT_LOGGED'));
  readonly total = computed(() => this.queue().length);
  readonly logged = computed(() => this.total() - this.remaining().length);
  readonly progress = computed(() => (this.total() === 0 ? 0 : this.logged() / this.total()));
  readonly isDone = computed(() => this.total() > 0 && this.remaining().length === 0);
  readonly tally = computed(() => tallyEod(this.queue().flatMap((e) => (e.mark ? [e.mark] : []))));

  readonly counts = computed(() => {
    const c: Record<EodBucket, number> = { NOT_LOGGED: 0, ON_PACE: 0, NEEDS_SUPPORT: 0, BLOCKED: 0 };
    for (const e of this.queue()) c[e.bucket] += 1;
    return c;
  });

  private readonly searched = (list: readonly EodEntry[]) => {
    const term = this.searchTerm();
    return list.filter((e) => matchesSearch(term, e.name, e.apprentice.email));
  };

  readonly groups = computed(() => {
    const bucket = this.activeBucket();
    return groupBySpecialization(
      this.searched(this.queue()).filter((e) => e.bucket === bucket || (bucket === 'NOT_LOGGED' && e.revealing)),
    );
  });
  readonly visibleCount = computed(() => this.groups().reduce((n, g) => n + g.entries.length, 0));

  /** Absent / excused today — muted, collapsed, still editable. */
  readonly away = computed(() => this.searched(this.scope().filter((e) => e.lane === 'AWAY')));
  /** No attendance yet today — nudges the coach to finish the sweep first. */
  readonly notCheckedIn = computed(() => this.searched(this.scope().filter((e) => e.lane === 'NOT_CHECKED_IN')));

  readonly chips = computed<readonly SpecializationChip[]>(() => {
    const groups = new Map<Id, { specialization: Specialization; remaining: number; total: number }>();
    for (const e of this.entries()) {
      if (!e.specialization || e.lane !== 'QUEUE') continue;
      const g = groups.get(e.specialization.id) ?? { specialization: e.specialization, remaining: 0, total: 0 };
      groups.set(e.specialization.id, {
        ...g,
        total: g.total + 1,
        remaining: g.remaining + (e.bucket === 'NOT_LOGGED' ? 1 : 0),
      });
    }
    return [...groups.values()]
      .sort((a, b) => a.specialization.name.localeCompare(b.specialization.name))
      .map((g) => ({
        specialization: g.specialization,
        badge: g.remaining > 0 ? g.remaining : null,
        done: g.remaining === 0,
        hint: `${g.remaining} not logged`,
      }));
  });

  readonly scopeLabel = computed(() => {
    const spec = this.specFilter();
    const specName = spec === 'ALL' ? null : (this.refs.specializationById().get(spec)?.name ?? null);
    return describeScope(specName, coachFilterLabel(this.coachFilter(), this.coaches()));
  });

  readonly canUndo = computed(() => this.activity().length > 0);

  // ── Commands ───────────────────────────────────────────────────────────────
  setSearch(text: string): void {
    this.searchText.set(text);
    this.search$.next(text);
  }

  /**
   * The sweep gesture. Unrated → On Pace (card lingers for {@link EOD_REVEAL_MS}).
   * Returns `'details'` when the page should open the drawer instead (second tap, or already rated).
   */
  tap(apprenticeId: Id): 'marked' | 'details' {
    const entry = this.entryById().get(apprenticeId);
    if (!entry) return 'details';
    if (entry.mark === null && this.apply([{ apprenticeId, next: ON_PACE }])) {
      this.reveal(apprenticeId);
      return 'marked';
    }
    return 'details';
  }

  setMark(apprenticeId: Id, next: EodMark): void {
    const entry = this.entryById().get(apprenticeId);
    if (!entry || sameMark(entry.mark, next)) return;
    const wasUnrated = entry.mark === null;
    if (this.apply([{ apprenticeId, next }]) && wasUnrated && entry.lane === 'QUEUE' && this.activeBucket() === 'NOT_LOGGED') {
      this.reveal(apprenticeId);
    }
  }

  resetMark(apprenticeId: Id): void {
    if (this.entryById().get(apprenticeId)?.mark) this.apply([{ apprenticeId, next: null }]);
  }

  /** Everyone still "Not Logged" in the queue (scope) becomes On Pace in one atomic write. */
  closeoutRemaining(): void {
    const targets = this.remaining();
    if (targets.length) this.apply(targets.map((e) => ({ apprenticeId: e.id, next: ON_PACE })));
  }

  undoLast(): void {
    const last = this.activity()[0];
    if (last) this.undo(last.id);
  }

  undo(activityId: number): void {
    const item = this.activity().find((a) => a.id === activityId);
    if (!item) return;
    this.activity.update((list) => list.filter((a) => a.id !== activityId));
    const marks = this.markById();
    if (item.changes.some((c) => !sameMark(marks.get(c.apprenticeId) ?? null, c.next))) {
      this.toasts.show({ tone: 'warning', message: 'Already changed since — nothing to undo.' });
      return;
    }
    if (this.apply(item.changes.map((c) => ({ apprenticeId: c.apprenticeId, next: c.previous })), false)) {
      this.toasts.show({ message: `Undone: ${item.label}` });
    }
  }

  // ── Internals ──────────────────────────────────────────────────────────────
  /** Single write path: optimistic overlay → port commands → settle; records an undo step unless `record` is false. */
  private apply(changes: readonly { apprenticeId: Id; next: EodMark | null }[], record = true): boolean {
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
    if (upserts.length) commands.push(this.eodRepo.upsertMany(upserts));
    if (clears.length) commands.push(this.eodRepo.clearMany(clears, date));

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

    if (record) this.record(full);
    return true;
  }

  private record(changes: readonly MarkChange[]): void {
    const first = changes[0];
    if (!first) return;
    const outcome = first.next ? EOD_STATUS_LABELS[first.next.status] : 'Not Logged';
    const label =
      changes.length === 1
        ? `${this.entryById().get(first.apprenticeId)?.name ?? 'Apprentice'} → ${outcome}`
        : `${changes.length} marked ${outcome}`;
    const id = ++this.seq;
    this.activity.update((list) => [{ id, label, changes }, ...list].slice(0, UNDO_DEPTH));
    this.toasts.show({
      tone: first.next?.status === 'ON_PACE' ? 'success' : 'info',
      message: label,
      action: { label: 'Undo', run: () => this.undo(id) },
    });
  }

  private reveal(id: Id): void {
    clearTimeout(this.revealTimers.get(id));
    this.revealing.update((s) => new Set(s).add(id));
    this.revealTimers.set(
      id,
      setTimeout(() => this.unreveal(id), EOD_REVEAL_MS),
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
