import { HEALTH_TIER_LABELS, onPaceRate, type IsoDate } from '../../domain';
import type { Passport } from './cohort-health.store';

const BRIEF_TIMELINE_ITEMS = 8;

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

/** Plain-text coaching brief for a 1-on-1, ready to paste into chat or notes. */
export function buildOneOnOneBrief({ entry: e, timeline }: Passport, cohortName: string, today: IsoDate): string {
  const h = e.health;
  const trajectory = e.trajectory.map((t) => `W${t.week} ${t.rating ?? '—'}`).join(' → ') || '—';
  const sprints = e.sprints
    .map((m, i) => (m ? `S${i + 1} ${m.score} (${m.projectName})` : null))
    .filter(Boolean)
    .join(' · ');

  const lines = [
    `1-on-1 brief — ${e.name}`,
    `${cohortName} · ${e.specialization?.name ?? 'No specialization'} · Coach: ${e.coachName ?? 'Unassigned'} · ${today}`,
    '',
    `Health: ${HEALTH_TIER_LABELS[h.tier]} · Composite ${h.score}/100${h.silentDrift ? ' · Silent Drift' : ''}`,
    `Attendance ${pct(e.attendance.attendanceRate)} · Punctuality ${pct(e.attendance.punctualityRate)} ` +
      `(P ${e.attendance.P} · L ${e.attendance.L} · A ${e.attendance.A} · E ${e.attendance.E})`,
    `EOD on pace ${e.eod.total ? pct(onPaceRate(e.eod)) : '—'} (${e.eod.ON_PACE} OP · ${e.eod.NEEDS_SUPPORT} NS · ${e.eod.BLOCKED} BL)`,
    `Behavior: ${trajectory}`,
    ...(sprints ? [`Sprints: ${sprints}`] : []),
  ];

  if (h.reasons.length) lines.push('', 'Talking points:', ...h.reasons.map((r) => `• ${r}`));

  const recent = timeline.slice(0, BRIEF_TIMELINE_ITEMS);
  if (recent.length) {
    lines.push('', 'Recent notes:', ...recent.map((t) => `• ${t.date} — ${t.title}${t.detail ? `: ${t.detail}` : ''}`));
  }
  return lines.join('\n');
}
