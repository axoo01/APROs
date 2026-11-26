import type { BehaviorRating } from '../models';
import type { AttendanceTally } from './attendance-metrics.rules';
import type { EodTally } from './eod.rules';
import { assessHealth, compositeScore, phaseTwoReadiness, systemicBlockers, type HealthInput } from './health-score.rules';

const att = (P: number, L = 0, A = 0, E = 0): AttendanceTally => ({ P, L, A, E, total: P + L + A + E });
const eod = (ON_PACE: number, NEEDS_SUPPORT = 0, BLOCKED = 0): EodTally => ({
  ON_PACE,
  NEEDS_SUPPORT,
  BLOCKED,
  total: ON_PACE + NEEDS_SUPPORT + BLOCKED,
});
const input = (o: Partial<HealthInput> = {}): HealthInput => ({
  attendance: att(20),
  eod: eod(20),
  recentEod: eod(5),
  behaviorTrend: ['+H', '+H'] as BehaviorRating[],
  absenceStreak: 0,
  behindStreak: 0,
  ...o,
});

describe('health score rules', () => {
  it('scores a perfect record 100 and marks it thriving', () => {
    const a = assessHealth(input());
    expect(a).toMatchObject({ score: 100, tier: 'THRIVING', latestRating: '+H', silentDrift: false, reasons: [] });
  });

  it('renormalizes weights when EOD and behavior are missing', () => {
    expect(compositeScore({ attendance: 1, punctuality: 1, eod: null, behavior: null })).toBe(100);
    expect(compositeScore({ attendance: 0.8, punctuality: 0.6, eod: null, behavior: null })).toBe(74);
    expect(compositeScore({ attendance: 1, punctuality: 1, eod: 0.6, behavior: 0 })).toBe(65);
  });

  it('flags absence streaks, -L ratings and repeated blockers as at risk', () => {
    expect(assessHealth(input({ absenceStreak: 3 }))).toMatchObject({ tier: 'AT_RISK', reasons: ['3d absent streak'] });
    expect(assessHealth(input({ behaviorTrend: ['+M', '-L'] })).tier).toBe('AT_RISK');
    expect(assessHealth(input({ behindStreak: 3 })).reasons[0]).toBe('3d behind on EOD');
    expect(assessHealth(input({ recentEod: eod(3, 0, 2) })).reasons[0]).toBe('Blocked 2× this week');
  });

  it('detects Silent Drift: high attendance but EOD dropped and a flagged rating', () => {
    const a = assessHealth(input({ attendance: att(19, 0, 1), behaviorTrend: ['+M', '-M'], behindStreak: 2 }));
    expect(a.tier).toBe('WATCHLIST');
    expect(a.silentDrift).toBe(true);
    expect(a.reasons[0]).toBe('Attendance 95%, but EOD dropped + -M behavior');
  });

  it('treats a two-tier behavior slide as drift', () => {
    const a = assessHealth(input({ behaviorTrend: ['+H', '+L'] }));
    expect(a.silentDrift).toBe(true);
    expect(a.reasons[0]).toBe('Attendance 100%, but behavior slipped +H → +L');
  });

  it('watchlists a soft score, naming the weak pillar; a weak pillar alone does not demote', () => {
    const soft = assessHealth(input({ attendance: att(12, 4, 6), eod: eod(10, 6, 4), behaviorTrend: ['+L'] }));
    expect(soft.tier).toBe('WATCHLIST');
    expect(soft.silentDrift).toBe(false);
    expect(soft.reasons[0]).toBe('Attendance 73%');
    expect(assessHealth(input({ attendance: att(14, 2, 4) })).tier).toBe('THRIVING');
  });

  it('derives Phase 2 readiness', () => {
    expect(phaseTwoReadiness({ score: 82, tier: 'WATCHLIST' })).toBe('READY');
    expect(phaseTwoReadiness({ score: 69, tier: 'THRIVING' })).toBe('NEEDS_PAIRING');
    expect(phaseTwoReadiness({ score: 90, tier: 'AT_RISK' })).toBe('NEEDS_PAIRING');
  });

  it('finds blocker tags shared by 2+ apprentices on behind days', () => {
    const out = systemicBlockers([
      { apprenticeId: 'a', status: 'BLOCKED', tag: 'ENVIRONMENT' },
      { apprenticeId: 'a', status: 'BLOCKED', tag: 'ENVIRONMENT' },
      { apprenticeId: 'b', status: 'NEEDS_SUPPORT', tag: 'ENVIRONMENT' },
      { apprenticeId: 'c', status: 'ON_PACE', tag: 'ENVIRONMENT' },
      { apprenticeId: 'c', status: 'BLOCKED', tag: 'TECHNICAL' },
      { apprenticeId: 'd', status: 'BLOCKED', tag: 'OTHER' },
      { apprenticeId: 'e', status: 'BLOCKED', tag: 'OTHER' },
    ]);
    expect(out).toEqual([{ tag: 'ENVIRONMENT', apprenticeIds: ['a', 'b'] }]);
  });
});
