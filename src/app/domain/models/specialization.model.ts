import type { Auditable, Id } from './common.model';

/** Brand palette ramps a specialization may be tagged with (see styles/tokens.css). */
export const COLOR_TAGS = [
  'orange',
  'light-blue',
  'teal',
  'purple',
  'green',
  'pink',
  'indigo',
  'yellow',
  'ultramarine',
  'red',
] as const;
export type ColorTag = (typeof COLOR_TAGS)[number];

export interface Specialization extends Auditable {
  readonly id: Id;
  readonly name: string;
  /** Short, unique, uppercase code, e.g. `FE`. */
  readonly code: string;
  readonly colorTag: ColorTag;
  readonly isActive: boolean;
}
