/**
 * Schema reserved for later milestones (Phase 2 sprints). Not yet persisted or seeded.
 * EOD pacing: `eod.model.ts` · weekly behavior: `behavior.model.ts`.
 */
import type { Auditable, Id } from './common.model';

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
