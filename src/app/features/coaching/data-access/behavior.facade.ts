import { Injectable, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map, type Observable } from 'rxjs';
import {
  BEHAVIOR_DEFINITIONS,
  EOD_TAG_LABELS,
  REASON_LABELS,
  STATUS_LABELS,
  apprenticeDisplayName,
  behaviorId,
  currentCohortWeek,
  phaseOneWeeks,
  isFlaggedRating,
  isPositiveRating,
  isStandardBehaviorNote,
  isUrgentRating,
  summarizeAttendance,
  tallyEod,
  type Apprentice,
  type AttendanceRecord,
  type AttendanceSummary,
  type BehaviorMark,
  type BehaviorRating,
  type CohortWeek,
  type EodPacingRecord,
  type EodTally,
  type Id,
  type IsoDate,
  type Specialization,
  type WeeklyBehaviorRecord,
} from '../../../domain';
import { Clock } from '../../../core/platform/clock.service';
import { CohortContextStore } from '../../../core/state/cohort-context.store';
import { ReferenceDataStore } from '../../../core/state/reference-data.store';
import { ApprenticeRepository } from '../../../data/ports/apprentice.repository';
import { AttendanceRepository } from '../../../data/ports/attendance.repository';
import { BehaviorRepository } from '../../../data/ports/behavior.repository';
import { EodRepository } from '../../../data/ports/eod.repository';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { RATING_TONE } from '../../../shared/utils/behavior-rating.const';
import { errorMessage } from '../../../shared/utils/error-message.util';
import {
  coachFilterLabel,
  describeScope,
  inRosterScope,
  matchesSearch,
  type CoachFilter,
} from '../../../shared/utils/roster-scope.util';
import { streamFor } from '../../../shared/utils/stream-for.util';

const SEARCH_DEBOUNCE_MS = 150;
/** Week pills and the trajectory both span the last 4 cohort weeks. */
const WEEK_SPAN = 4;

export type BehaviorKpi = 'UNRATED' | 'POSITIVE' | 'FLAGGED' | 'URGENT';

export interface ContextNote {
  readonly date: IsoDate;
  readonly source: 'Attendance' | 'EOD';
  readonly text: string;
}

export interface BehaviorEntry {
  readonly id: Id;
  readonly weekStart: IsoDate;
  readonly apprentice: Apprentice;
  readonly name: string;
  readonly specialization: Specialization | undefined;
  readonly coachName: string | null;
  readonly rating: BehaviorRating | null;
  readonly note: string | null;
  /** This week's attendance and EOD digests. */
  readonly attendance: AttendanceSummary;
  readonly eod: EodTally;
  /** Ratings for the last cohort weeks up to the selected one (oldest first). */
  readonly trajectory: readonly { readonly week: number; readonly rating: BehaviorRating | null }[];
  /** Attendance reasons/notes and EOD notes logged this week. */
  readonly notes: readonly ContextNote[];
}

export interface BehaviorGroup {
  readonly specialization: Specialization | undefined;
  readonly entries: readonly BehaviorEntry[];
}

/**
 * Weekly behavior: 6-tier ratings per apprentice per cohort week, with live weekly context
 * (attendance, EOD, trajectory, notes), KPI filters, standard-note prefill and an undoable "+M" closeout.
 */
@Injectable()
export class BehaviorFacade {
  private readonly ctx = inject(CohortContextStore);
  private readonly refs = inject(ReferenceDataStore);
  private readonly clock = inject(Clock);
  private readonly apprenticeRepo = inject(ApprenticeRepository);
  private readonly attendanceRepo = inject(AttendanceRepository);
  private readonly eodRepo = inject(EodRepository);
  private readonly behaviorRepo = inject(BehaviorRepository);
  private readonly toasts = inject(ToastService);

  readonly cohort = this.ctx.activeCohort;
  readonly today = this.clock.today;
  readonly coaches = this.refs.coachOptions;
  readonly showMine = this.refs.currentUserIsCoach;

  // ── Sources ────────────────────────────────────────────────────────────────
  private readonly cohortId = computed(() => this.cohort()?.id ?? null);
  private readonly apprentices = streamFor(this.cohortId, (id) => this.apprenticeRepo.watchByCohort(id), [] as readonly Apprentice[]);
  private readonly attendance = streamFor(this.cohortId, (id) => this.attendanceRepo.watchByCohort(id), [] as readonly AttendanceRecord[]);
  private readonly eod = streamFor(this.cohortId, (id) => this.eodRepo.watchByCohort(id), [] as readonly EodPacingRecord[]);
  private readonly ratings = streamFor(this.cohortId, (id) => this.behaviorRepo.watchByCohort(id), [] as readonly WeeklyBehaviorRecord[]);
  private readonly ratingById = computed(() => new Map(this.ratings().map((r) => [r.id, r])));

  // ── Filters ────────────────────────────────────────────────────────────────
  /** All Phase 1 weeks (Week 1 → Week 13) for the week selector; upcoming weeks can't be rated yet. */
  readonly weeks = computed<readonly CohortWeek[]>(() => {
    const c = this.cohort();
    return c ? phaseOneWeeks(c) : [];
  });
  readonly currentWeek = computed(() => currentCohortWeek(this.weeks(), this.today()));
  private readonly pickedWeek = signal<IsoDate | null>(null);
  readonly week = computed(() => this.weeks().find((w) => w.start === this.pickedWeek()) ?? this.currentWeek());

  private readonly hasOwnGroup = computed(() => {
    const me = this.refs.currentUser();
    return me?.role === 'COACH' && this.apprentices().some((a) => a.status === 'ACTIVE' && a.coachId === me.id);
  });
  /** Defaults to "Mine" for a coach with a group; a manual choice sticks. */
  readonly coachFilter = linkedSignal<CoachFilter>(() => (this.hasOwnGroup() ? 'MINE' : 'ALL'));
  readonly kpiFocus = signal<BehaviorKpi | null>(null);
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

  // ── Entries ────────────────────────────────────────────────────────────────
  private readonly scope = computed<readonly BehaviorEntry[]>(() => {
    const week = this.week();
    if (!week) return [];
    const today = this.today();
    const end = week.end < today ? week.end : today;
    const inWeek = (d: IsoDate) => d >= week.start && d <= end;
    const span = this.weeks().filter((w) => w.start <= week.start).slice(-WEEK_SPAN);

    const attByApprentice = new Map<Id, AttendanceRecord[]>();
    for (const r of this.attendance()) if (inWeek(r.date)) push(attByApprentice, r.apprenticeId, r);
    const eodByApprentice = new Map<Id, EodPacingRecord[]>();
    for (const r of this.eod()) if (inWeek(r.date)) push(eodByApprentice, r.apprenticeId, r);

    const specs = this.refs.specializationById();
    const users = this.refs.userById();
    const byId = this.ratingById();
    const scope = { spec: 'ALL' as const, coach: this.coachFilter(), me: this.refs.currentUser()?.id ?? null };

    return this.apprentices()
      .filter((a) => a.status === 'ACTIVE' && inRosterScope(a, scope))
      .map((a): BehaviorEntry => {
        const att = attByApprentice.get(a.id) ?? [];
        const eod = eodByApprentice.get(a.id) ?? [];
        const current = byId.get(behaviorId(a.id, week.start));
        return {
          id: a.id,
          weekStart: week.start,
          apprentice: a,
          name: apprenticeDisplayName(a),
          specialization: specs.get(a.specializationId),
          coachName: a.coachId ? (users.get(a.coachId)?.fullName ?? null) : null,
          rating: current?.rating ?? null,
          note: current?.note ?? null,
          attendance: summarizeAttendance(att),
          eod: tallyEod(eod),
          trajectory: span.map((w) => ({ week: w.number, rating: byId.get(behaviorId(a.id, w.start))?.rating ?? null })),
          notes: contextNotes(att, eod),
        };
      })
      .sort((x, y) => x.name.localeCompare(y.name));
  });

  readonly entryById = computed(() => new Map(this.scope().map((e) => [e.id, e])));

  readonly counts = computed(() => {
    const c: Record<BehaviorKpi, number> = { UNRATED: 0, POSITIVE: 0, FLAGGED: 0, URGENT: 0 };
    for (const e of this.scope()) {
      if (!e.rating) c.UNRATED += 1;
      if (isPositiveRating(e.rating)) c.POSITIVE += 1;
      if (isFlaggedRating(e.rating)) c.FLAGGED += 1;
      if (isUrgentRating(e.rating)) c.URGENT += 1;
    }
    return c;
  });
  readonly total = computed(() => this.scope().length);
  readonly remaining = computed(() => this.scope().filter((e) => !e.rating));

  readonly groups = computed<readonly BehaviorGroup[]>(() => {
    const term = this.searchTerm();
    const focus = this.kpiFocus();
    const keep = (e: BehaviorEntry) =>
      focus === 'UNRATED' ? !e.rating
      : focus === 'POSITIVE' ? isPositiveRating(e.rating)
      : focus === 'FLAGGED' ? isFlaggedRating(e.rating)
      : focus === 'URGENT' ? isUrgentRating(e.rating)
      : true;
    const byGroup = new Map<string, BehaviorEntry[]>();
    for (const e of this.scope()) {
      if (keep(e) && matchesSearch(term, e.name, e.apprentice.email)) push(byGroup, e.specialization?.id ?? '', e);
    }
    return [...byGroup.values()]
      .map((entries) => ({ specialization: entries[0]?.specialization, entries }))
      .sort((a, b) => (a.specialization?.name ?? '~').localeCompare(b.specialization?.name ?? '~'));
  });
  readonly visibleCount = computed(() => this.groups().reduce((n, g) => n + g.entries.length, 0));

  readonly scopeLabel = computed(() => describeScope(null, coachFilterLabel(this.coachFilter(), this.coaches())));

  // ── Commands ───────────────────────────────────────────────────────────────
  selectWeek(start: IsoDate): void {
    if (start <= this.today()) this.pickedWeek.set(start);
  }

  /** Previous / next week, bounded by Week 1 and the current week. */
  stepWeek(direction: -1 | 1): void {
    const weeks = this.weeks();
    const i = weeks.findIndex((w) => w.start === this.week()?.start);
    const next = weeks[i + direction];
    if (next) this.selectWeek(next.start);
  }

  toggleKpi(kpi: BehaviorKpi): void {
    this.kpiFocus.update((current) => (current === kpi ? null : kpi));
  }

  setSearch(text: string): void {
    this.searchText.set(text);
    this.search$.next(text);
  }

  /**
   * Rates an apprentice. The note becomes the rating's standard definition unless the coach has custom text
   * (`customNote` from an unsaved draft, or a saved non-standard note).
   */
  rate(apprenticeId: Id, rating: BehaviorRating, customNote: string | null = null): void {
    const e = this.entryById().get(apprenticeId);
    if (!e || (e.rating === rating && !customNote)) return;
    const note = customNote ?? (isStandardBehaviorNote(e.note) ? BEHAVIOR_DEFINITIONS[rating] : e.note);
    this.apply([{ entry: e, next: { rating, note } }], e.name);
  }

  saveNote(apprenticeId: Id, note: string): void {
    const e = this.entryById().get(apprenticeId);
    if (!e?.rating || (e.note ?? '') === note.trim()) return;
    this.apply([{ entry: e, next: { rating: e.rating, note: note.trim() || null } }], `Note saved for ${e.name}`);
  }

  clear(apprenticeId: Id): void {
    const e = this.entryById().get(apprenticeId);
    if (e?.rating) this.apply([{ entry: e, next: null }], `${e.name} → Unrated`);
  }

  /** Everyone still unrated in scope gets +M with its standard note, in one atomic write. */
  closeoutRemaining(): void {
    const targets = this.remaining();
    if (!targets.length) return;
    this.apply(
      targets.map((entry) => ({ entry, next: { rating: '+M' as const, note: BEHAVIOR_DEFINITIONS['+M'] } })),
      `${targets.length} marked +M`,
    );
  }

  // ── Internals ──────────────────────────────────────────────────────────────
  /** Writes (upsert + clear, each atomic) for the selected week and offers an undo that restores prior marks. */
  private apply(changes: readonly { entry: BehaviorEntry; next: BehaviorMark | null }[], label: string): void {
    const week = this.week();
    if (!week || !changes.length) return;
    const previous = changes.map((c) => ({
      entry: c.entry,
      next: c.entry.rating ? { rating: c.entry.rating, note: c.entry.note } : null,
    }));
    this.run(this.write(week.start, changes), () =>
      this.toasts.show({
        tone: 'success',
        message: label,
        ...(changes[0]?.next ? { badge: { text: changes[0].next.rating, className: RATING_TONE[changes[0].next.rating].solid } } : {}),
        group: 'behavior',
        action: { label: 'Undo', run: () => this.run(this.write(week.start, previous), () => undefined) },
      }),
    );
  }

  private write(weekStart: IsoDate, changes: readonly { entry: BehaviorEntry; next: BehaviorMark | null }[]): Observable<unknown> {
    const upserts = changes.flatMap((c) => (c.next ? [{ apprenticeId: c.entry.id, weekStart, ...c.next }] : []));
    const clears = changes.filter((c) => !c.next).map((c) => c.entry.id);
    const commands: Observable<unknown>[] = [];
    if (upserts.length) commands.push(this.behaviorRepo.upsertMany(upserts));
    if (clears.length) commands.push(this.behaviorRepo.clearMany(clears, weekStart));
    return forkJoin(commands);
  }

  private run(command: Observable<unknown>, onDone: () => void): void {
    command.subscribe({
      next: onDone,
      error: (err: unknown) => this.toasts.show({ tone: 'danger', message: errorMessage(err) }),
    });
  }
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Attendance reasons/notes (non-Present) and EOD tags/notes for the week, oldest first. */
function contextNotes(att: readonly AttendanceRecord[], eod: readonly EodPacingRecord[]): ContextNote[] {
  const notes: ContextNote[] = [];
  for (const r of att) {
    if (r.status === 'P' || (!r.reason && !r.note)) continue;
    const parts = [STATUS_LABELS[r.status], r.reason ? REASON_LABELS[r.reason] : null, r.note].filter(Boolean);
    notes.push({ date: r.date, source: 'Attendance', text: parts.join(' · ') });
  }
  for (const r of eod) {
    if (!r.note) continue;
    const parts = [r.tag ? EOD_TAG_LABELS[r.tag] : null, r.note].filter(Boolean);
    notes.push({ date: r.date, source: 'EOD', text: parts.join(' — ') });
  }
  return notes.sort((a, b) => a.date.localeCompare(b.date));
}
