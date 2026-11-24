import type { Cohort, IsoDate } from '../models';
import { diffDays } from '../utils/date.util';

export type CohortPhaseKind = 'UPCOMING' | 'PHASE_1' | 'INTERMISSION' | 'PHASE_2' | 'COMPLETED';

export interface CohortPhase {
  readonly kind: CohortPhaseKind;
  /** 1-based week within the active phase; `null` outside a phase. */
  readonly week: number | null;
  /** Total (possibly partial) weeks in the active phase; `null` outside a phase. */
  readonly totalWeeks: number | null;
  /** Days until the next milestone (phase start/end); `null` once completed. */
  readonly daysToNextMilestone: number | null;
}

type PhaseDates = Pick<Cohort, 'phase1StartDate' | 'phase1EndDate' | 'phase2StartDate' | 'phase2EndDate'>;

const weekIndex = (start: IsoDate, date: IsoDate): number => Math.floor(diffDays(start, date) / 7) + 1;
const weekCount = (start: IsoDate, end: IsoDate): number => Math.ceil((diffDays(start, end) + 1) / 7);

export function resolveCohortPhase(cohort: PhaseDates, today: IsoDate): CohortPhase {
  const { phase1StartDate: p1s, phase1EndDate: p1e, phase2StartDate: p2s, phase2EndDate: p2e } = cohort;

  if (today < p1s) {
    return { kind: 'UPCOMING', week: null, totalWeeks: null, daysToNextMilestone: diffDays(today, p1s) };
  }
  if (today <= p1e) {
    return { kind: 'PHASE_1', week: weekIndex(p1s, today), totalWeeks: weekCount(p1s, p1e), daysToNextMilestone: diffDays(today, p1e) };
  }
  if (today < p2s) {
    return { kind: 'INTERMISSION', week: null, totalWeeks: null, daysToNextMilestone: diffDays(today, p2s) };
  }
  if (today <= p2e) {
    return { kind: 'PHASE_2', week: weekIndex(p2s, today), totalWeeks: weekCount(p2s, p2e), daysToNextMilestone: diffDays(today, p2e) };
  }
  return { kind: 'COMPLETED', week: null, totalWeeks: null, daysToNextMilestone: null };
}

export const PHASE_LABELS: Readonly<Record<CohortPhaseKind, string>> = {
  UPCOMING: 'Upcoming',
  PHASE_1: 'Phase 1',
  INTERMISSION: 'Break',
  PHASE_2: 'Phase 2',
  COMPLETED: 'Completed',
};

export function describePhase(phase: CohortPhase): string {
  const label = PHASE_LABELS[phase.kind];
  return phase.week !== null && phase.totalWeeks !== null
    ? `${label} · Wk ${phase.week}/${phase.totalWeeks}`
    : label;
}
