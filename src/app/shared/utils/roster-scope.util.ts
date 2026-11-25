import type { Apprentice, Id } from '../../domain';

/** `ALL` · `MINE` (current user's apprentices) · a specific coach's user id. */
export type CoachFilter = 'ALL' | 'MINE' | Id;
export type SpecFilter = Id | 'ALL';

export interface RosterScope {
  readonly spec: SpecFilter;
  readonly coach: CoachFilter;
  /** Current user id, for "Mine". */
  readonly me: Id | null;
}

export interface CoachOption {
  readonly id: Id;
  readonly name: string;
}

/** Specialization + coach scope shared by every roster screen (attendance, coaching, …). */
export function inRosterScope(a: Pick<Apprentice, 'specializationId' | 'coachId'>, scope: RosterScope): boolean {
  if (scope.spec !== 'ALL' && a.specializationId !== scope.spec) return false;
  if (scope.coach === 'ALL') return true;
  const coachId = scope.coach === 'MINE' ? scope.me : scope.coach;
  return coachId !== null && a.coachId === coachId;
}

/** Case-insensitive name/email match; `term` is already trimmed + lower-cased. */
export function matchesSearch(term: string, name: string, email: string): boolean {
  return !term || name.toLowerCase().includes(term) || email.toLowerCase().includes(term);
}

/** Display name for a coach filter (null for "All"). */
export function coachFilterLabel(coach: CoachFilter, coaches: readonly CoachOption[]): string | null {
  if (coach === 'ALL') return null;
  if (coach === 'MINE') return 'your group';
  const name = coaches.find((c) => c.id === coach)?.name;
  return name ? `${name}'s group` : null;
}

/** Human label for a scope, e.g. "DE · Nelly's group"; null = whole cohort. */
export function describeScope(specName: string | null, coachLabel: string | null): string | null {
  const parts = [specName, coachLabel].filter((p): p is string => !!p);
  return parts.length ? parts.join(' · ') : null;
}
