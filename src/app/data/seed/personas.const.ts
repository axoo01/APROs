import type { Role } from '../../domain';

/** Demo personas offered on the login screen. Emails match seeded users. */
export interface DemoPersona {
  readonly role: Role;
  readonly label: string;
  readonly email: string;
  readonly blurb: string;
}

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  {
    role: 'ADMIN',
    label: 'Head of Coaches',
    email: 'abena.owusu-ansah@apros.demo',
    blurb: 'Full access — cohorts, onboarding, assignments and Phase 2 sprint marks.',
  },
  {
    role: 'COACH',
    label: 'Coach',
    email: 'axcel@apros.demo',
    blurb: 'Daily attendance, EOD pacing and weekly behavior for any apprentice.',
  },
];

export function personaFor(role: Role): DemoPersona {
  const p = DEMO_PERSONAS.find((x) => x.role === role);
  if (!p) throw new Error(`No demo persona for role ${role}`);
  return p;
}
