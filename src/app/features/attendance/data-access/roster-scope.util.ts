import type { Apprentice, Id } from '../../../domain';

export type CoachFilter = 'ALL' | 'MINE' | 'UNASSIGNED';
export type SpecFilter = Id | 'ALL';

export interface RosterScope {
  readonly spec: SpecFilter;
  readonly coach: CoachFilter;
  /** Current user id, for "Mine". */
  readonly me: Id | null;
}

/** Specialization + coach scope shared by the sweep and the log. */
export function inRosterScope(a: Pick<Apprentice, 'specializationId' | 'coachId'>, scope: RosterScope): boolean {
  if (scope.spec !== 'ALL' && a.specializationId !== scope.spec) return false;
  switch (scope.coach) {
    case 'ALL':
      return true;
    case 'MINE':
      return a.coachId !== null && a.coachId === scope.me;
    case 'UNASSIGNED':
      return a.coachId === null;
  }
}

/** Case-insensitive name/email match; `term` is already trimmed + lower-cased. */
export function matchesSearch(term: string, name: string, email: string): boolean {
  return !term || name.toLowerCase().includes(term) || email.toLowerCase().includes(term);
}

/** Human label for a scope, e.g. "Frontend · your group"; null = whole cohort. */
export function describeScope(specName: string | null, coach: CoachFilter): string | null {
  const parts = [
    specName,
    coach === 'MINE' ? 'your group' : null,
    coach === 'UNASSIGNED' ? 'unassigned apprentices' : null,
  ].filter((p): p is string => !!p);
  return parts.length ? parts.join(' · ') : null;
}
