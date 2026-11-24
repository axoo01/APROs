import type { Role } from '../models';
import { ForbiddenError } from '../errors/domain.errors';

export const PERMISSIONS = [
  'cohort.create',
  'cohort.update',
  'cohort.delete',
  'specialization.manage',
  'apprentice.onboard',
  'apprentice.assign',
  'attendance.record',
  'eod.record',
  'behavior.record',
  'sprint.record',
  'dashboard.view',
  'data.export',
  'demo.reset',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const COACH_PERMISSIONS: readonly Permission[] = [
  'attendance.record',
  'eod.record',
  'behavior.record',
  'dashboard.view',
  'data.export',
  'demo.reset',
];

const MATRIX: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  ADMIN: new Set(PERMISSIONS),
  COACH: new Set(COACH_PERMISSIONS),
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return role ? MATRIX[role].has(permission) : false;
}

export function assertCan(role: Role | null | undefined, permission: Permission): void {
  if (!can(role, permission)) {
    throw new ForbiddenError(`Your role is not allowed to perform "${permission}".`);
  }
}
