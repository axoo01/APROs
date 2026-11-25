import {
  REASON_LABELS,
  type AttendanceStatus,
  type AttendanceSummary,
  type Cohort,
} from '../../../domain';
import type { SweepEntry } from './attendance.facade';

export interface DayReportInput {
  readonly cohort: Pick<Cohort, 'code' | 'displayName'>;
  /** Already localized, e.g. "Tue, 24 Nov 2026". */
  readonly dateLabel: string;
  /** Active filter scope, e.g. "Frontend · your group"; null = whole cohort. */
  readonly scopeLabel: string | null;
  readonly summary: AttendanceSummary;
  readonly entries: readonly SweepEntry[];
}

const SECTIONS: readonly { status: AttendanceStatus; title: string }[] = [
  { status: 'A', title: 'Absent' },
  { status: 'L', title: 'Late' },
  { status: 'E', title: 'Excused' },
];

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

/**
 * Plain-text day report for Slack / Teams: header, rates, raw counts, then bulleted Absent / Late / Excused
 * lists with specialization and reason/note. No markup, so it pastes cleanly anywhere.
 */
export function formatDayReport(input: DayReportInput): string {
  const { cohort, summary: s } = input;
  const cohortName = cohort.displayName.includes(cohort.code) ? cohort.displayName : `${cohort.displayName} (${cohort.code})`;

  const lines = [
    `Attendance · ${cohortName} · ${input.dateLabel}`,
    ...(input.scopeLabel ? [`Scope: ${input.scopeLabel}`] : []),
    `Attendance ${pct(s.attendanceRate)} · Punctuality ${pct(s.punctualityRate)}`,
    `P ${s.P} · L ${s.L} · A ${s.A} · E ${s.E} · ${input.entries.length} apprentices`,
  ];

  for (const { status, title } of SECTIONS) {
    const people = input.entries.filter((e) => e.mark?.status === status);
    lines.push('', `${title} (${people.length})`);
    if (!people.length) lines.push('• None');
    for (const e of people) {
      const detail = [e.mark?.reason ? REASON_LABELS[e.mark.reason] : null, e.mark?.note ? `"${e.mark.note}"` : null]
        .filter(Boolean)
        .join(' · ');
      const spec = e.specialization ? ` (${e.specialization.name})` : '';
      lines.push(`• ${e.name}${spec}${detail ? ` — ${detail}` : ''}`);
    }
  }
  return lines.join('\n');
}
