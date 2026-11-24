import { COLOR_TAGS, type ColorTag } from '../../domain';

export type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** CSS var reference for a brand ramp step, e.g. `var(--color-teal-500)` — for dynamic, data-driven colors. */
export function colorTagVar(tag: ColorTag, shade: Shade = 500): string {
  return `var(--color-${tag}-${shade})`;
}

/** Stable color for an arbitrary id (avatars), drawn from the brand palette. */
export function colorTagForId(id: string): ColorTag {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return COLOR_TAGS[Math.abs(h) % COLOR_TAGS.length]!;
}
