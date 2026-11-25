import type { Auditable, Id, IsoDate, IsoDateTime } from './common.model';

/** End-of-day pacing: how an apprentice is tracking against the day's plan. */
export const EOD_STATUSES = ['ON_PACE', 'NEEDS_SUPPORT', 'BLOCKED'] as const;
export type EodStatus = (typeof EOD_STATUSES)[number];

export const EOD_TAGS = [
  'GREAT_PROGRESS',
  'AHEAD_OF_TIME',
  'SOLID_DELIVERY',
  'TIME_MGMT',
  'MISSED_TARGET',
  'CONCEPTS',
  'ENVIRONMENT',
  'ROUGH_DAY',
  'TECHNICAL',
  'OTHER',
] as const;
export type EodTag = (typeof EOD_TAGS)[number];

export const EOD_STATUS_LABELS: Readonly<Record<EodStatus, string>> = {
  ON_PACE: 'On Pace',
  NEEDS_SUPPORT: 'Needs Support',
  BLOCKED: 'Blocked',
};

export const EOD_TAG_LABELS: Readonly<Record<EodTag, string>> = {
  GREAT_PROGRESS: 'Great Progress',
  AHEAD_OF_TIME: 'Ahead of Time',
  SOLID_DELIVERY: 'Solid Delivery',
  TIME_MGMT: 'Slow Pacing',
  MISSED_TARGET: 'Missed Target',
  CONCEPTS: 'Needs Guidance',
  ENVIRONMENT: 'Access / Connectivity',
  ROUGH_DAY: 'Rough Day',
  TECHNICAL: 'Technical Blocker',
  OTHER: 'Other',
};

/** A 1-tap preset: selects the tag and pre-fills an editable note. */
export interface EodPreset {
  readonly tag: EodTag;
  readonly note: string;
}

/** Three presets per status — positive for On Pace, blockers otherwise. */
export const EOD_PRESETS: Readonly<Record<EodStatus, readonly EodPreset[]>> = {
  ON_PACE: [
    { tag: 'GREAT_PROGRESS', note: 'Strong momentum today—making impressive progress on current tasks.' },
    { tag: 'AHEAD_OF_TIME', note: "Completed today's deliverables ahead of schedule with clean execution." },
    { tag: 'SOLID_DELIVERY', note: "Met today's milestone on pace and kept steady focus." },
  ],
  NEEDS_SUPPORT: [
    { tag: 'TIME_MGMT', note: "Moving a bit slowly on today's work; needs tighter task breakdown tomorrow." },
    { tag: 'MISSED_TARGET', note: "Couldn't meet today's target milestone; following up to get back on track." },
    { tag: 'CONCEPTS', note: 'Needs guidance from a tech reviewer to clarify concepts and unblock next steps.' },
  ],
  BLOCKED: [
    { tag: 'ENVIRONMENT', note: 'Blocked by internet instability or missing material/tool access.' },
    { tag: 'ROUGH_DAY', note: 'Having a cold/rough day—low energy or personal friction slowed progress.' },
    { tag: 'TECHNICAL', note: 'Hit a tough technical blocker; flagged for immediate pairing.' },
  ],
};

/** Every preset sentence — lets editors tell an auto-filled note from one the coach typed. */
export const EOD_PRESET_NOTES: ReadonlySet<string> = new Set(
  Object.values(EOD_PRESETS).flatMap((list) => list.map((p) => p.note)),
);

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
