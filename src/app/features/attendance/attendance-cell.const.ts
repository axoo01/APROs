import { REASON_LABELS, STATUS_LABELS, type AttendanceRecord, type Id, type IsoDate } from '../../domain';

/** Log cell colours: A is solid so absences pop when scanning a matrix; others stay soft. */
export function cellTone(record: AttendanceRecord | null): string {
  switch (record?.status) {
    case 'P':
      return 'bg-status-p-soft text-status-p';
    case 'L':
      return 'bg-status-l-soft text-warning';
    case 'A':
      return 'bg-status-a text-on-status-a';
    case 'E':
      return 'bg-status-e-soft text-status-e';
    default:
      return 'border border-dashed border-line text-fg-subtle';
  }
}

/** "Late · Traffic — note" or "No record". */
export function cellDescription(record: AttendanceRecord | null): string {
  if (!record) return 'No record';
  const parts = [STATUS_LABELS[record.status], record.reason ? REASON_LABELS[record.reason] : null].filter(Boolean);
  return parts.join(' · ') + (record.note ? ` — ${record.note}` : '');
}

export interface CellSelection {
  readonly apprenticeId: Id;
  readonly date: IsoDate;
}
