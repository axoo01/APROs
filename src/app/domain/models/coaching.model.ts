/**
 * Schema reserved for later milestones (EOD pacing, weekly behavior, Phase 2 sprints).
 * Declared now so the normalized store shape is stable; not yet persisted or seeded.
 */
import type { Auditable, Id, IsoDate } from './common.model';

export const BEHAVIOR_RATINGS = ['+H', '+M', '-L'] as const;
export type BehaviorRating = (typeof BEHAVIOR_RATINGS)[number];

export interface WeeklyBehavior extends Auditable {
  readonly id: Id;
  readonly apprenticeId: Id;
  readonly cohortId: Id;
  /** Monday of the rated week. */
  readonly weekStart: IsoDate;
  readonly rating: BehaviorRating;
  readonly note: string | null;
  readonly recordedBy: Id;
}

export interface EodPacingEntry extends Auditable {
  readonly id: Id;
  readonly apprenticeId: Id;
  readonly cohortId: Id;
  readonly date: IsoDate;
  readonly note: string | null;
  readonly recordedBy: Id;
}

export interface SprintMark extends Auditable {
  readonly id: Id;
  readonly apprenticeId: Id;
  readonly cohortId: Id;
  readonly sprintNumber: number;
  readonly projectName: string;
  readonly score: number;
  readonly deliverableSummary: string;
  readonly recordedBy: Id;
}
