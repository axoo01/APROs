import type { Auditable, Id } from './common.model';

export const APPRENTICE_STATUSES = ['ACTIVE', 'WITHDRAWN', 'GRADUATED'] as const;
export type ApprenticeStatus = (typeof APPRENTICE_STATUSES)[number];

export interface Apprentice extends Auditable {
  readonly id: Id;
  readonly firstName: string;
  readonly lastName: string;
  readonly preferredName: string | null;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly cohortId: Id;
  readonly specializationId: Id;
  /** `null` = Unassigned. */
  readonly coachId: Id | null;
  readonly status: ApprenticeStatus;
}

export function apprenticeDisplayName(a: Pick<Apprentice, 'firstName' | 'lastName' | 'preferredName'>): string {
  return `${a.preferredName ?? a.firstName} ${a.lastName}`;
}
