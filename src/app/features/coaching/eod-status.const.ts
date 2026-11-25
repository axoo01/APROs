import { EOD_BEHIND_THRESHOLD, EOD_STATUS_LABELS, EOD_TAG_LABELS, type EodMark, type EodStatus } from '../../domain';

/** Semantic utility classes per EOD status. Blocked is solid so it pops when scanning. */
export const EOD_TONE: Readonly<Record<EodStatus, { solid: string; soft: string; ring: string; dot: string }>> = {
  ON_PACE: { solid: 'bg-success text-on-status-p', soft: 'bg-success-soft text-success', ring: 'ring-success', dot: 'bg-success' },
  NEEDS_SUPPORT: {
    solid: 'bg-status-l text-on-status-l',
    soft: 'bg-warning-soft text-warning',
    ring: 'ring-status-l',
    dot: 'bg-status-l',
  },
  BLOCKED: { solid: 'bg-danger text-on-status-a', soft: 'bg-danger-soft text-danger', ring: 'ring-danger', dot: 'bg-danger' },
};

/** Two-letter code for compact cells and badges. */
export const EOD_SHORT: Readonly<Record<EodStatus, string>> = { ON_PACE: 'OP', NEEDS_SUPPORT: 'NS', BLOCKED: 'BL' };

/** Matrix cell tone: Blocked solid, others soft; no record = dashed. */
export function eodCellTone(status: EodStatus | null | undefined): string {
  if (!status) return 'border border-dashed border-line text-fg-subtle';
  return status === 'BLOCKED' ? EOD_TONE.BLOCKED.solid : EOD_TONE[status].soft;
}

/** "Needs Support · Git / PR — note" or "Not logged". */
export function eodDescription(mark: EodMark | null | undefined): string {
  if (!mark) return 'Not logged';
  const parts = [EOD_STATUS_LABELS[mark.status], mark.tag ? EOD_TAG_LABELS[mark.tag] : null].filter(Boolean);
  return parts.join(' · ') + (mark.note ? ` — ${mark.note}` : '');
}

export interface BehindFlag {
  readonly label: string;
  readonly description: string;
}

/** "2d behind" pill when Needs Support / Blocked runs ≥ the domain threshold. */
export function behindFlag(streak: number): BehindFlag | null {
  return streak >= EOD_BEHIND_THRESHOLD
    ? { label: `${streak}d behind`, description: `Needs support or blocked ${streak} working days in a row` }
    : null;
}
