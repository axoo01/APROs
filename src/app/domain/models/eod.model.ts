import type { Auditable, Id, IsoDate, IsoDateTime } from './common.model';

/** End-of-day pacing: how an apprentice is tracking against the day's plan. */
export const EOD_STATUSES = ['ON_PACE', 'NEEDS_SUPPORT', 'BLOCKED'] as const;
export type EodStatus = (typeof EOD_STATUSES)[number];

export const EOD_TAGS = ['GREAT_PROGRESS', 'CONCEPTS', 'GIT_PR', 'ENVIRONMENT', 'TIME_MGMT', 'OTHER'] as const;
export type EodTag = (typeof EOD_TAGS)[number];

export const EOD_STATUS_LABELS: Readonly<Record<EodStatus, string>> = {
  ON_PACE: 'On Pace',
  NEEDS_SUPPORT: 'Needs Support',
  BLOCKED: 'Blocked',
};

export const EOD_TAG_LABELS: Readonly<Record<EodTag, string>> = {
  GREAT_PROGRESS: 'Great Progress',
  CONCEPTS: 'Concepts',
  GIT_PR: 'Git / PR',
  ENVIRONMENT: 'Environment',
  TIME_MGMT: 'Time Mgmt',
  OTHER: 'Other',
};

/** Tags offered first for each status (positive for On Pace, blockers otherwise). Any tag remains valid. */
export const EOD_TAGS_FOR_STATUS: Readonly<Record<EodStatus, readonly EodTag[]>> = {
  ON_PACE: ['GREAT_PROGRESS', 'OTHER'],
  NEEDS_SUPPORT: ['CONCEPTS', 'GIT_PR', 'ENVIRONMENT', 'TIME_MGMT', 'OTHER'],
  BLOCKED: ['CONCEPTS', 'GIT_PR', 'ENVIRONMENT', 'TIME_MGMT', 'OTHER'],
};

export interface EodPacingRecord extends Auditable {
  /** Deterministic: `${apprenticeId}:${date}` — one record per apprentice per working day. */
  readonly id: Id;
  readonly apprenticeId: Id;
  readonly cohortId: Id;
  readonly date: IsoDate;
  readonly status: EodStatus;
  readonly tag: EodTag | null;
  readonly note: string | null;
  readonly recordedBy: Id;
  readonly recordedAt: IsoDateTime;
}

/** The editable part of an EOD record. */
export type EodMark = Pick<EodPacingRecord, 'status' | 'tag' | 'note'>;

export interface UpsertEodInput {
  readonly apprenticeId: Id;
  readonly date: IsoDate;
  readonly status: EodStatus;
  readonly tag?: EodTag | null;
  readonly note?: string | null;
}

export function eodId(apprenticeId: Id, date: IsoDate): Id {
  return `${apprenticeId}:${date}`;
}
