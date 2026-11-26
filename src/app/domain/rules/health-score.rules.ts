import { BEHAVIOR_RATINGS, EOD_TAGS, type BehaviorRating, type EodStatus, type EodTag, type Id } from '../models';
import { attendanceRate, punctualityRate, type AttendanceTally } from './attendance-metrics.rules';
import { isFlaggedRating, isUrgentRating } from './behavior.rules';
import { isBehind, onPaceRate, type EodTally } from './eod.rules';

export const HEALTH_TIERS = ['THRIVING', 'WATCHLIST', 'AT_RISK'] as const;
export type HealthTier = (typeof HEALTH_TIERS)[number];

export const HEALTH_TIER_LABELS: Readonly<Record<HealthTier, string>> = {
  THRIVING: 'Thriving',
  WATCHLIST: 'Watchlist',
  AT_RISK: 'At Risk',
};

/** Pillar weights of the composite score. Missing pillars (no EOD / no ratings yet) are dropped and the rest renormalized. */
export const HEALTH_WEIGHTS = { attendance: 0.35, punctuality: 0.15, eod: 0.25, behavior: 0.25 } as const;

/** Each behavior tier as a 0–1 pillar value. */
export const BEHAVIOR_SCORES: Readonly<Record<BehaviorRating, number>> = {
  '+H': 1,
  '+M': 0.85,
  '+L': 0.7,
  '-H': 0.45,
  '-M': 0.25,
  '-L': 0,
};

export const HEALTH_THRESHOLDS = {
  /** Composite below this → At Risk. */
  atRiskScore: 60,
  /** Composite below this → Watchlist. */
  watchScore: 75,
  /** Consecutive `A` days → At Risk. */
  absenceStreak: 2,
  /** Consecutive Needs Support / Blocked days → At Risk ("repeated blockers"). */
  behindStreak: 3,
  /** Blocked days in the recent window → At Risk. */
  recentBlocked: 2,
  /** Behind streak that counts as an EOD dip (below the At Risk streak). */
  behindDip: 2,
  /** Silent Drift: attendance at least this high, yet EOD or behavior is slipping. */
  driftAttendance: 0.9,
  /** Recent on-pace this many points below the overall rate (and under the ceiling) = EOD dip. */
  eodDrop: 0.2,
  eodDipCeiling: 0.6,
  /** A behavior slide of this many tiers between consecutive rated weeks = dip. */
  behaviorDropTiers: 2,
  /** Pillar weaknesses called out as context in reasons (they don't change the tier on their own). */
  weakAttendance: 0.85,
  weakPunctuality: 0.7,
  weakOnPace: 0.55,
  /** Phase 2 readiness: composite at least this and not At Risk. */
  readyScore: 70,
} as const;

export interface HealthInput {
  /** Raw attendance counts over the reporting window (cohort to date). */
  readonly attendance: AttendanceTally;
  /** EOD tallies: whole window and the most recent working week. */
  readonly eod: EodTally;
  readonly recentEod: EodTally;
  /** Ratings of the recent cohort weeks, oldest first (`null` = unrated week). */
  readonly behaviorTrend: readonly (BehaviorRating | null)[];
  readonly absenceStreak: number;
  readonly behindStreak: number;
}

/** 0–1 pillar values; `null` = no data for that pillar (excluded from the composite). */
export interface HealthPillars {
  readonly attendance: number;
  readonly punctuality: number;
  readonly eod: number | null;
  readonly behavior: number | null;
}

export interface HealthAssessment {
  /** Composite Readiness Score, whole number 0–100. */
  readonly score: number;
  readonly tier: HealthTier;
  readonly pillars: HealthPillars;
  /** Most recent rated week, if any. */
  readonly latestRating: BehaviorRating | null;
  /** High attendance masking an EOD/behavior slide (only set on Watchlist — At Risk outranks it). */
  readonly silentDrift: boolean;
  /** Plain-English reasons, most severe first; empty when thriving. */
  readonly reasons: readonly string[];
}

const pct = (rate: number): number => Math.round(rate * 100);
const rated = (trend: readonly (BehaviorRating | null)[]): BehaviorRating[] =>
  trend.filter((r): r is BehaviorRating => r !== null);

export function healthPillars(input: HealthInput): HealthPillars {
  const ratings = rated(input.behaviorTrend);
  return {
    attendance: attendanceRate(input.attendance),
    punctuality: punctualityRate(input.attendance),
    eod: input.eod.total === 0 ? null : onPaceRate(input.eod),
    behavior: ratings.length ? ratings.reduce((s, r) => s + BEHAVIOR_SCORES[r], 0) / ratings.length : null,
  };
}

/** Weighted mean of the available pillars, as a whole number 0–100. */
export function compositeScore(p: HealthPillars): number {
  const parts: [number, number][] = [
    [p.attendance, HEALTH_WEIGHTS.attendance],
    [p.punctuality, HEALTH_WEIGHTS.punctuality],
  ];
  if (p.eod !== null) parts.push([p.eod, HEALTH_WEIGHTS.eod]);
  if (p.behavior !== null) parts.push([p.behavior, HEALTH_WEIGHTS.behavior]);
  const weight = parts.reduce((s, [, w]) => s + w, 0);
  return Math.round((parts.reduce((s, [v, w]) => s + v * w, 0) / weight) * 100);
}

/**
 * Composite score + tier + reasons. Deterministic and pure.
 * - **At Risk**: absence streak ≥ 2, `-L` latest rating, behind streak ≥ 3 or ≥ 2 Blocked recently, or score < 60.
 * - **Watchlist**: Silent Drift (attendance ≥ 90% but EOD dipped or behavior slid), a flagged rating, or score < 75.
 * Weak pillars (attendance < 85%, punctuality < 70%, on pace < 55%) are added as context, never a trigger on their own.
 * - **Thriving** otherwise.
 */
export function assessHealth(input: HealthInput): HealthAssessment {
  const T = HEALTH_THRESHOLDS;
  const pillars = healthPillars(input);
  const score = compositeScore(pillars);
  const ratings = rated(input.behaviorTrend);
  const latest = ratings.at(-1) ?? null;
  const previous = ratings.at(-2) ?? null;

  // ── Signals ──
  const recentRate = onPaceRate(input.recentEod);
  const eodDip =
    input.behindStreak >= T.behindDip ||
    (input.recentEod.total >= 2 &&
      pillars.eod !== null &&
      recentRate <= pillars.eod - T.eodDrop &&
      recentRate < T.eodDipCeiling);
  const slid =
    latest !== null &&
    previous !== null &&
    BEHAVIOR_RATINGS.indexOf(latest) - BEHAVIOR_RATINGS.indexOf(previous) >= T.behaviorDropTiers;
  const behaviorDip = (isFlaggedRating(latest) && !isUrgentRating(latest)) || slid;
  const behaviorText = slid && !isFlaggedRating(latest) ? `behavior slipped ${previous} → ${latest}` : `${latest} behavior`;

  // ── At Risk ──
  const risk: string[] = [];
  if (input.absenceStreak >= T.absenceStreak) risk.push(`${input.absenceStreak}d absent streak`);
  if (isUrgentRating(latest)) risk.push('-L behavior (urgent)');
  if (input.behindStreak >= T.behindStreak) risk.push(`${input.behindStreak}d behind on EOD`);
  else if (input.recentEod.BLOCKED >= T.recentBlocked) risk.push(`Blocked ${input.recentEod.BLOCKED}× this week`);
  if (score < T.atRiskScore) risk.push(`Low composite score (${score})`);

  // ── Weak pillars (context for any tier) ──
  const weak: string[] = [];
  if (pillars.attendance < T.weakAttendance) weak.push(`Attendance ${pct(pillars.attendance)}%`);
  if (pillars.punctuality < T.weakPunctuality) weak.push(`Punctuality ${pct(pillars.punctuality)}%`);
  if (pillars.eod !== null && pillars.eod < T.weakOnPace) weak.push(`On pace ${pct(pillars.eod)}%`);

  if (risk.length) {
    const extra = behaviorDip && !isUrgentRating(latest) ? [capitalize(behaviorText)] : [];
    return { score, tier: 'AT_RISK', pillars, latestRating: latest, silentDrift: false, reasons: [...risk, ...extra, ...weak] };
  }

  const drift = pillars.attendance >= T.driftAttendance && (eodDip || behaviorDip);
  if (drift) {
    const parts = [eodDip ? 'EOD dropped' : null, behaviorDip ? behaviorText : null].filter(Boolean);
    const label = `Attendance ${pct(pillars.attendance)}%, but ${parts.join(' + ')}`;
    return { score, tier: 'WATCHLIST', pillars, latestRating: latest, silentDrift: true, reasons: [label, ...weak] };
  }

  const watch: string[] = [];
  if (eodDip) watch.push(input.behindStreak >= T.behindDip ? `${input.behindStreak}d behind on EOD` : 'EOD dropped this week');
  if (behaviorDip) watch.push(capitalize(behaviorText));
  if (score < T.watchScore && watch.length === 0) watch.push(weak.length ? weak.shift()! : `Composite score ${score}`);
  if (watch.length) {
    return { score, tier: 'WATCHLIST', pillars, latestRating: latest, silentDrift: false, reasons: [...watch, ...weak] };
  }

  return { score, tier: 'THRIVING', pillars, latestRating: latest, silentDrift: false, reasons: [] };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type PhaseTwoReadiness = 'READY' | 'NEEDS_PAIRING';

/** Ready for Phase 2 = composite ≥ 70 and not At Risk; otherwise pair them with support. */
export function phaseTwoReadiness(a: Pick<HealthAssessment, 'score' | 'tier'>): PhaseTwoReadiness {
  return a.tier !== 'AT_RISK' && a.score >= HEALTH_THRESHOLDS.readyScore ? 'READY' : 'NEEDS_PAIRING';
}

export interface SystemicBlocker {
  readonly tag: EodTag;
  readonly apprenticeIds: readonly Id[];
}

/**
 * Blocker tags that hit at least `minApprentices` different apprentices on Needs Support / Blocked days
 * (pass this week's records). `OTHER` is too vague to be systemic. Most widespread first.
 */
export function systemicBlockers(
  records: Iterable<{ readonly apprenticeId: Id; readonly status: EodStatus; readonly tag: EodTag | null }>,
  minApprentices = 2,
): SystemicBlocker[] {
  const byTag = new Map<EodTag, Set<Id>>();
  for (const r of records) {
    if (!isBehind(r.status) || r.tag === null || r.tag === 'OTHER') continue;
    const set = byTag.get(r.tag) ?? new Set<Id>();
    set.add(r.apprenticeId);
    byTag.set(r.tag, set);
  }
  return [...byTag.entries()]
    .filter(([, ids]) => ids.size >= minApprentices)
    .map(([tag, ids]) => ({ tag, apprenticeIds: [...ids] }))
    .sort((a, b) => b.apprenticeIds.length - a.apprenticeIds.length || EOD_TAGS.indexOf(a.tag) - EOD_TAGS.indexOf(b.tag));
}
