import type { HealthTier, SprintBand } from '../../domain';

/** Tier tones: Thriving = emerald (success), Watchlist = amber (warning), At Risk = rose (danger). */
export const TIER_TONE: Readonly<Record<HealthTier, { soft: string; dot: string; text: string; bar: string }>> = {
  THRIVING: { soft: 'bg-success-soft text-success', dot: 'bg-success', text: 'text-success', bar: 'bg-success' },
  WATCHLIST: { soft: 'bg-warning-soft text-warning', dot: 'bg-status-l', text: 'text-warning', bar: 'bg-status-l' },
  AT_RISK: { soft: 'bg-danger-soft text-danger', dot: 'bg-danger', text: 'text-danger', bar: 'bg-danger' },
};

/** Sprint score chip tones. */
export const SPRINT_TONE: Readonly<Record<SprintBand, string>> = {
  STRONG: 'bg-success-soft text-success',
  SOLID: 'bg-surface-2 text-fg',
  DEVELOPING: 'bg-warning-soft text-warning',
};
