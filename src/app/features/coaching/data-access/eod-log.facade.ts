import { formatDate } from '@angular/common';
import { Injectable, LOCALE_ID, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, map, type Observable } from 'rxjs';
import {
  EOD_STATUS_LABELS,
  apprenticeDisplayName,
  attendanceId,
  behindStreak,
  eodId,
  EOD_BEHIND_THRESHOLD,
  longestBehindRun,
  onPaceRate,
  resolveLogWindow,
  tallyEod,
  workingDaysBetween,
  type Apprentice,
  type AttendanceRecord,
  type EodMark,
  type EodPacingRecord,
  type EodTally,
  type Id,
  type IsoDate,
  type LogPreset,
  type Specialization,
} from '../../../domain';
import { Clock } from '../../../core/platform/clock.service';
import { CohortContextStore } from '../../../core/state/cohort-context.store';
import { ReferenceDataStore } from '../../../core/state/reference-data.store';
import { ApprenticeRepository } from '../../../data/ports/apprentice.repository';
import { AttendanceRepository } from '../../../data/ports/attendance.repository';
import { EodRepository } from '../../../data/ports/eod.repository';
import type { MatrixGroup } from '../../../shared/components/status-matrix/status-matrix.component';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { colorTagVar } from '../../../shared/utils/color-tag.util';
import { errorMessage } from '../../../shared/utils/error-message.util';
import {
  coachFilterLabel,
  describeScope,
  inRosterScope,
  matchesSearch,
  type CoachFilter,
} from '../../../shared/utils/roster-scope.util';
import { streamFor } from '../../../shared/utils/stream-for.util';
import type { EodTarget } from '../components/eod-drawer/eod-drawer.component';
import { EOD_SHORT, eodCellTone, eodDescription } from '../eod-status.const';

const SEARCH_DEBOUNCE_MS = 150;

/** KPI cards double as filter / rank toggles. */
export type EodKpi = 'ON_PACE' | 'NEEDS_SUPPORT' | 'BLOCKED' | 'BEHIND';
/** On-pace share below this is highlighted. */
const LOW_ON_PACE = 0.7;

interface EodRow {
  readonly id: Id;
  readonly apprentice: Apprentice;
  readonly name: string;
  readonly specialization: Specialization | undefined;
  readonly coachName: string | null;
  readonly cells: readonly { date: IsoDate; record: EodPacingRecord | null }[];
  readonly tally: EodTally;
  /** Longest consecutive Needs Support / Blocked run in the window. */
  readonly behindRun: number;
  readonly followUp: boolean;
}

export interface EodTrackStats {
  readonly onPace: number;
  readonly needsSupport: number;
  readonly blocked: number;
  readonly unlogged: number;
  readonly onPaceRate: number;
  /** Apprentices in the track with a behind run in the window. */
  readonly behind: number;
}

/** One specialization: collapsible summary (segmented bar) over its matrix rows. */
export interface EodTrack {
  readonly key: string;
  readonly specialization: Specialization | undefined;
  readonly matrix: MatrixGroup;
  readonly stats: EodTrackStats;
}

const pct = (rate: number) => `${Math.round(rate * 100)}%`;
/** Sort key for "lowest On Pace first": unrated rows rank last. */
const rankRate = (r: { tally: EodTally }) => (r.tally.total ? onPaceRate(r.tally) : 2);

/** EOD history: weekly / 30-day pacing matrix with retroactive edits (undoable). */
@Injectable()
export class EodLogFacade {
  private readonly ctx = inject(CohortContextStore);
  private readonly refs = inject(ReferenceDataStore);
  private readonly clock = inject(Clock);
  private readonly locale = inject(LOCALE_ID);
  private readonly apprenticeRepo = inject(ApprenticeRepository);
  private readonly attendanceRepo = inject(AttendanceRepository);
  private readonly eodRepo = inject(EodRepository);
  private readonly toasts = inject(ToastService);

  readonly cohort = this.ctx.activeCohort;
  readonly today = this.clock.today;
  readonly coaches = this.refs.coachOptions;
  readonly showMine = this.refs.currentUserIsCoach;

  readonly preset = signal<LogPreset>('THIS_WEEK');
  readonly coachFilter = signal<CoachFilter>('ALL');
  readonly kpiFocus = signal<EodKpi | null>(null);
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

  private readonly cohortId = computed(() => this.cohort()?.id ?? null);
  private readonly apprentices = streamFor(
    this.cohortId,
    (id) => this.apprenticeRepo.watchByCohort(id),
    [] as readonly Apprentice[],
  );
  private readonly history = streamFor(
    this.cohortId,
    (id) => this.eodRepo.watchByCohort(id),
    [] as readonly EodPacingRecord[],
  );
  private readonly attendance = streamFor(
    this.cohortId,
    (id) => this.attendanceRepo.watchByCohort(id),
    [] as readonly AttendanceRecord[],
  );
  private readonly recordById = computed(() => new Map(this.history().map((r) => [r.id, r])));
  private readonly attendanceById = computed(() => new Map(this.attendance().map((r) => [r.id, r.status])));

  readonly days = computed(() => {
    const c = this.cohort();
    if (!c) return [];
    const w = resolveLogWindow(this.preset(), this.today(), this.today());
    const start = w.start < c.phase1StartDate ? c.phase1StartDate : w.start;
    const end = w.end > this.today() ? this.today() : w.end;
    return start > end ? [] : workingDaysBetween(c, start, end);
  });

  private readonly coachScopeRows = computed<readonly EodRow[]>(() => {
    const days = this.days();
    const byId = this.recordById();
    const specs = this.refs.specializationById();
    const users = this.refs.userById();
    const scope = { spec: 'ALL' as const, coach: this.coachFilter(), me: this.refs.currentUser()?.id ?? null };
    return this.apprentices()
      .filter((a) => a.status === 'ACTIVE' && inRosterScope(a, scope))
      .map((a) => {
        const cells = days.map((date) => ({ date, record: byId.get(eodId(a.id, date)) ?? null }));
        const tally = tallyEod(cells.flatMap((c) => (c.record ? [c.record] : [])));
        const behindRun = longestBehindRun(cells.map((c) => c.record?.status));
        return {
          id: a.id,
          apprentice: a,
          name: apprenticeDisplayName(a),
          specialization: specs.get(a.specializationId),
          coachName: a.coachId ? (users.get(a.coachId)?.fullName ?? null) : null,
          cells,
          tally,
          behindRun,
          followUp: behindRun >= EOD_BEHIND_THRESHOLD,
        };
      })
      .sort((x, y) => x.name.localeCompare(y.name));
  });

  /** Coach scope only — specializations are the collapsible tracks below, not a filter. */
  private readonly scopeRows = this.coachScopeRows;

  /** Search + KPI focus: filters (support / blocked / behind) and ranks worst-first. */
  readonly visibleRows = computed(() => {
    const term = this.searchTerm();
    const focus = this.kpiFocus();
    const rows = this.scopeRows().filter((r) => matchesSearch(term, r.name, r.apprentice.email));
    switch (focus) {
      case 'ON_PACE':
        // Unrated rows sink to the bottom; otherwise lowest On-Pace share first.
        return [...rows].sort((a, b) => rankRate(a) - rankRate(b));
      case 'NEEDS_SUPPORT':
        return rows.filter((r) => r.tally.NEEDS_SUPPORT > 0).sort((a, b) => b.tally.NEEDS_SUPPORT - a.tally.NEEDS_SUPPORT);
      case 'BLOCKED':
        return rows.filter((r) => r.tally.BLOCKED > 0).sort((a, b) => b.tally.BLOCKED - a.tally.BLOCKED);
      case 'BEHIND':
        return rows.filter((r) => r.followUp).sort((a, b) => b.behindRun - a.behindRun);
      default:
        return rows;
    }
  });

  /** Search or a KPI card is active → matching tracks open automatically. */
  readonly autoExpand = computed(() => !!this.searchTerm() || this.kpiFocus() !== null);
  private readonly openedManually = signal<ReadonlySet<string>>(new Set());
  private readonly closedManually = signal<ReadonlySet<string>>(new Set());

  readonly tally = computed(() =>
    tallyEod(this.scopeRows().flatMap((r) => r.cells.flatMap((c) => (c.record ? [c.record] : [])))),
  );
  readonly onPace = computed(() => onPaceRate(this.tally()));
  readonly followUpCount = computed(() => this.scopeRows().filter((r) => r.followUp).length);

  readonly tracks = computed<readonly EodTrack[]>(() => {
    const byGroup = new Map<string, EodRow[]>();
    for (const r of this.visibleRows()) {
      const key = r.specialization?.id ?? 'none';
      const list = byGroup.get(key);
      if (list) list.push(r);
      else byGroup.set(key, [r]);
    }
    const days = this.days().length;
    const tracks = [...byGroup.entries()].map(([key, rows]): EodTrack => {
      const s = rows[0]?.specialization;
      const t = tallyEod(rows.flatMap((r) => r.cells.flatMap((c) => (c.record ? [c.record] : []))));
      const stats: EodTrackStats = {
        onPace: t.ON_PACE,
        needsSupport: t.NEEDS_SUPPORT,
        blocked: t.BLOCKED,
        unlogged: Math.max(rows.length * days - t.total, 0),
        onPaceRate: onPaceRate(t),
        behind: rows.filter((r) => r.followUp).length,
      };
      return {
        key,
        specialization: s,
        stats,
        matrix: {
          key,
          label: s?.name ?? 'No specialization',
          color: s ? colorTagVar(s.colorTag) : null,
          metrics: [{ text: pct(stats.onPaceRate) }, { text: String(t.NEEDS_SUPPORT + t.BLOCKED) }],
          rows: rows.map((r) => ({
            id: r.id,
            name: r.name,
            subtitle: r.coachName ?? 'Unassigned',
            flag: r.followUp ? `${r.behindRun}d behind` : null,
            metrics: r.tally.total
              ? [
                  { text: pct(onPaceRate(r.tally)), alert: onPaceRate(r.tally) < LOW_ON_PACE },
                  { text: String(r.tally.NEEDS_SUPPORT + r.tally.BLOCKED) },
                ]
              : [{ text: '—' }, { text: '—' }],
            cells: r.cells.map((c) => ({
              date: c.date,
              empty: c.record === null,
              text: c.record ? EOD_SHORT[c.record.status] : '·',
              tone: eodCellTone(c.record?.status),
              description: eodDescription(c.record),
              marked: !!c.record?.note || !!c.record?.tag,
            })),
          })),
        },
      };
    });
    // Tracks follow the active ranking (worst first); otherwise alphabetical.
    const focus = this.kpiFocus();
    const byName = (a: EodTrack, b: EodTrack) => a.matrix.label.localeCompare(b.matrix.label);
    const rank: Record<EodKpi, (a: EodTrack, b: EodTrack) => number> = {
      ON_PACE: (a, b) => a.stats.onPaceRate - b.stats.onPaceRate,
      NEEDS_SUPPORT: (a, b) => b.stats.needsSupport - a.stats.needsSupport,
      BLOCKED: (a, b) => b.stats.blocked - a.stats.blocked,
      BEHIND: (a, b) => b.stats.behind - a.stats.behind,
    };
    return tracks.sort((a, b) => (focus ? rank[focus](a, b) : 0) || byName(a, b));
  });

  readonly expandedKeys = computed(() => {
    const auto = this.autoExpand();
    const opened = this.openedManually();
    const closed = this.closedManually();
    return new Set(this.tracks().filter((t) => (auto ? !closed.has(t.key) : opened.has(t.key))).map((t) => t.key));
  });

  readonly scopeLabel = computed(() => {
    return describeScope(null, coachFilterLabel(this.coachFilter(), this.coaches()));
  });

  toggleTrack(key: string): void {
    const flip = (set: ReadonlySet<string>) => {
      const next = new Set(set);
      if (!next.delete(key)) next.add(key);
      return next;
    };
    if (this.autoExpand()) this.closedManually.update(flip);
    else this.openedManually.update(flip);
  }

  /** KPI cards toggle: clicking the active one clears it. */
  toggleKpi(kpi: EodKpi): void {
    this.kpiFocus.update((current) => (current === kpi ? null : kpi));
    this.closedManually.set(new Set());
  }

  setSearch(text: string): void {
    this.searchText.set(text);
    this.search$.next(text);
  }

  /** Drawer subject for one apprentice on one day (streak and attendance as of that day). */
  target(apprenticeId: Id, date: IsoDate): EodTarget | null {
    const row = this.coachScopeRows().find((r) => r.id === apprenticeId);
    const cohort = this.cohort();
    if (!row || !cohort) return null;
    const byId = this.recordById();
    const r = byId.get(eodId(apprenticeId, date));
    return {
      id: row.id,
      name: row.name,
      apprentice: row.apprentice,
      specialization: row.specialization,
      coachName: row.coachName,
      mark: r ? { status: r.status, tag: r.tag, note: r.note } : null,
      behindStreak: behindStreak({ get: (d) => byId.get(eodId(apprenticeId, d))?.status }, date, cohort),
      attendance: this.attendanceById().get(attendanceId(apprenticeId, date)) ?? null,
      dateLabel: formatDate(date, 'EEE, d MMM', this.locale),
    };
  }

  setMark(apprenticeId: Id, date: IsoDate, next: EodMark | null): void {
    const row = this.coachScopeRows().find((r) => r.id === apprenticeId);
    const current = this.recordById().get(eodId(apprenticeId, date));
    const previous: EodMark | null = current ? { status: current.status, tag: current.tag, note: current.note } : null;
    if (!row || (!previous && !next)) return;
    const label = `${row.name} · ${formatDate(date, 'EEE d MMM', this.locale)} → ${next ? EOD_STATUS_LABELS[next.status] : 'cleared'}`;
    this.run(this.write(apprenticeId, date, next), () =>
      this.toasts.show({
        tone: 'success',
        message: label,
        action: { label: 'Undo', run: () => this.run(this.write(apprenticeId, date, previous), () => undefined) },
      }),
    );
  }

  private write(apprenticeId: Id, date: IsoDate, mark: EodMark | null): Observable<unknown> {
    return mark ? this.eodRepo.upsert({ apprenticeId, date, ...mark }) : this.eodRepo.clearMany([apprenticeId], date);
  }

  private run(command: Observable<unknown>, onDone: () => void): void {
    command.subscribe({
      next: onDone,
      error: (err: unknown) => this.toasts.show({ tone: 'danger', message: errorMessage(err) }),
    });
  }
}
