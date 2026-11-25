import type { Auditable, Id, IsoDate, IsoDateTime } from './common.model';

/** 6-tier weekly behavior scale: positive (+H best → +L) and needs-attention (-H mildest → -L most serious). */
export const BEHAVIOR_RATINGS = ['+H', '+M', '+L', '-H', '-M', '-L'] as const;
export type BehaviorRating = (typeof BEHAVIOR_RATINGS)[number];

export const POSITIVE_RATINGS: readonly BehaviorRating[] = ['+H', '+M', '+L'];
export const FLAGGED_RATINGS: readonly BehaviorRating[] = ['-H', '-M', '-L'];

/** Standard definition per rating — pre-filled as the note, editable. */
export const BEHAVIOR_DEFINITIONS: Readonly<Record<BehaviorRating, string>> = {
  '+H': 'Proactive communication, strong ownership, helps peers, and exemplary professionalism.',
  '+M': 'Steady week overall. Consistent delivery, reliable routine, and communicates well.',
  '+L': 'Meeting baseline expectations with steady progress; room to build stronger initiative.',
  '-H': 'Minor dip in routine or punctuality this week; flagged early for a quick check-in.',
  '-M': 'Missed updates or inconsistent follow-through this week; needs closer coaching support.',
  '-L': 'Repeated missed updates, low engagement, or unexcused absences requiring immediate intervention.',
};

export const BEHAVIOR_LABELS: Readonly<Record<BehaviorRating, string>> = {
  '+H': 'Positive · High',
  '+M': 'Positive · Medium',
  '+L': 'Positive · Low',
  '-H': 'Needs attention · Mild',
  '-M': 'Needs attention · Moderate',
  '-L': 'Needs attention · Urgent',
};

export interface WeeklyBehaviorRecord extends Auditable {
  /** Deterministic: `${apprenticeId}:${weekStart}` — one rating per apprentice per cohort week. */
  readonly id: Id;
  readonly apprenticeId: Id;
  readonly cohortId: Id;
  /** Monday of the rated week. */
  readonly weekStart: IsoDate;
  readonly rating: BehaviorRating;
  readonly note: string | null;
  readonly recordedBy: Id;
  readonly recordedAt: IsoDateTime;
}

export type BehaviorMark = Pick<WeeklyBehaviorRecord, 'rating' | 'note'>;

export interface UpsertBehaviorInput {
  readonly apprenticeId: Id;
  readonly weekStart: IsoDate;
  readonly rating: BehaviorRating;
  readonly note?: string | null;
}

export function behaviorId(apprenticeId: Id, weekStart: IsoDate): Id {
  return `${apprenticeId}:${weekStart}`;
}
