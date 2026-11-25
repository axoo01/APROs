import type { AttendanceStatus } from '../../domain';

/** Semantic utility classes per attendance status (shared by cards, drawer, rail and summary). */
export const STATUS_TONE: Readonly<Record<AttendanceStatus, { solid: string; soft: string; ring: string }>> = {
  P: { solid: 'bg-status-p text-on-status-p', soft: 'bg-status-p-soft text-status-p', ring: 'ring-status-p' },
  L: { solid: 'bg-status-l text-on-status-l', soft: 'bg-status-l-soft text-warning', ring: 'ring-status-l' },
  A: { solid: 'bg-status-a text-on-status-a', soft: 'bg-status-a-soft text-status-a', ring: 'ring-status-a' },
  E: { solid: 'bg-status-e text-on-status-e', soft: 'bg-status-e-soft text-status-e', ring: 'ring-status-e' },
};

/** CSS color per status for SVG strokes (data-viz). */
export const STATUS_COLOR: Readonly<Record<AttendanceStatus, string>> = {
  P: 'var(--ap-status-p)',
  L: 'var(--ap-status-l)',
  A: 'var(--ap-status-a)',
  E: 'var(--ap-status-e)',
};

export const STATUS_KEYS: Readonly<Record<string, AttendanceStatus>> = { p: 'P', l: 'L', a: 'A', e: 'E' };
