import type { Auditable, Id, IsoDate } from './common.model';

export interface Cohort extends Auditable {
  readonly id: Id;
  /** Immutable. `YY-MM-SS`, e.g. `26-11-04`. */
  readonly code: string;
  /** Immutable. Four-digit year of `phase1StartDate`. */
  readonly year: number;
  /** Immutable. 1-12, month of `phase1StartDate`. */
  readonly month: number;
  /** Immutable. 1-based sequence within `year`. */
  readonly sequenceNumber: number;
  /** Editable label; defaults to `Cohort - {code}`. */
  readonly displayName: string;
  readonly phase1StartDate: IsoDate;
  readonly phase1EndDate: IsoDate;
  readonly phase2StartDate: IsoDate;
  readonly phase2EndDate: IsoDate;
  /** Public holidays / breaks. Weekends are always non-working. */
  readonly nonWorkingDays: readonly IsoDate[];
  /** Lifecycle (upcoming/phase/completed) is derived from dates; archiving is explicit. */
  readonly isArchived: boolean;
}

export interface CohortDates {
  readonly phase1StartDate: IsoDate;
  readonly phase1EndDate: IsoDate;
  readonly phase2StartDate: IsoDate;
  readonly phase2EndDate: IsoDate;
}

export interface CreateCohortInput extends CohortDates {
  readonly displayName?: string;
  readonly nonWorkingDays?: readonly IsoDate[];
}

/** Only mutable fields. `code`, `year`, `month`, `sequenceNumber` are intentionally absent. */
export type UpdateCohortInput = Partial<
  Pick<Cohort, 'displayName' | 'nonWorkingDays' | 'isArchived'> & CohortDates
>;
