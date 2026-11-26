import type { Auditable, Id, IsoDateTime } from './common.model';

/** Phase 2 runs four delivery sprints. */
export const SPRINT_NUMBERS = [1, 2, 3, 4] as const;
export type SprintNumber = (typeof SPRINT_NUMBERS)[number];

/** Sprint scores are whole numbers out of 100. */
export const SPRINT_SCORE_MAX = 100;
export const SPRINT_PROJECT_MAX_LENGTH = 80;

/** One Phase 2 delivery mark per apprentice per sprint (`id = apprenticeId:S{n}`, upsert). Admin-only writes. */
export interface SprintMark extends Auditable {
  readonly id: Id;
  readonly apprenticeId: Id;
  readonly cohortId: Id;
  readonly sprintNumber: SprintNumber;
  readonly projectName: string;
  readonly score: number;
  readonly deliverableSummary: string;
  readonly recordedBy: Id;
  readonly recordedAt: IsoDateTime;
}

/** The editable part of a sprint mark. */
export interface SprintMarkFields {
  readonly sprintNumber: SprintNumber;
  readonly projectName: string;
  readonly score: number;
  readonly deliverableSummary: string;
}

export interface UpsertSprintInput extends SprintMarkFields {
  readonly apprenticeId: Id;
}

export function sprintMarkId(apprenticeId: Id, sprintNumber: SprintNumber): Id {
  return `${apprenticeId}:S${sprintNumber}`;
}
