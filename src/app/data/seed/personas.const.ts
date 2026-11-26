import type { Role } from '../../domain';

/** Demo personas offered on the login screen. Emails match seeded users. */
export interface DemoPersona {
  readonly role: Role;
  readonly label: string;
  readonly email: string;
}

export const DEMO_PERSONAS: readonly DemoPersona[] = [
  {
    role: 'ADMIN',
    label: 'Head of Coaches',
    email: 'bob.karemera@apros.demo',
  },
  {
    role: 'COACH',
    label: 'Coach',
    email: 'axcel@apros.demo',
  },
];

export function personaFor(role: Role): DemoPersona {
  const p = DEMO_PERSONAS.find((x) => x.role === role);
  if (!p) throw new Error(`No demo persona for role ${role}`);
  return p;
}
