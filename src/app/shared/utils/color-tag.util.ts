import type { ColorTag } from '../../domain';

export type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** CSS var reference for a brand ramp step, e.g. `var(--color-teal-500)` — for dynamic, data-driven colors. */
export function colorTagVar(tag: ColorTag, shade: Shade = 500): string {
  return `var(--color-${tag}-${shade})`;
}
