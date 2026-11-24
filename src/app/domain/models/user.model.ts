import type { Auditable, Id } from './common.model';

export const ROLES = ['ADMIN', 'COACH'] as const;
export type Role = (typeof ROLES)[number];

export interface User extends Auditable {
  readonly id: Id;
  readonly fullName: string;
  readonly email: string;
  readonly role: Role;
  /** Short job title shown in the UI, e.g. "Head of Coaches". */
  readonly title: string;
  readonly avatarUrl: string | null;
  readonly isActive: boolean;
}
