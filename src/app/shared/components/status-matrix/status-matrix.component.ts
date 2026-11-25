import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, type ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import type { Id, IsoDate } from '../../../domain';

/** One day cell. `tone` = utility classes; `marked` shows a corner dot (reason / note present). */
export interface MatrixCell {
  readonly date: IsoDate;
  /** No record for the day. */
  readonly empty: boolean;
  readonly text: string;
  readonly tone: string;
  readonly description: string;
  readonly marked: boolean;
}

export interface MatrixMetric {
  readonly text: string;
  /** Highlights the value (e.g. below target). */
  readonly alert?: boolean;
}

export interface MatrixRow {
  readonly id: Id;
  readonly name: string;
  readonly subtitle: string;
  /** Short warning pill next to the name (e.g. "Follow up"); null hides it. */
  readonly flag: string | null;
  readonly cells: readonly MatrixCell[];
  /** One entry per `metricLabels` column. */
  readonly metrics: readonly MatrixMetric[];
}

export interface MatrixGroup {
  readonly key: string;
  readonly label: string;
  /** CSS colour for the group dot; null hides it. */
  readonly color: string | null;
  readonly rows: readonly MatrixRow[];
  readonly metrics: readonly MatrixMetric[];
}

export interface MatrixSelection {
  readonly rowId: Id;
  readonly date: IsoDate;
}

const METRIC_COL_REM = 4.75;

/**
 * Desktop status matrix: rows × working days, grouped, with a sticky name column and sticky metric columns.
 * Domain-agnostic (attendance, EOD, …): callers map their data to the view model.
 * Cells form a roving-tabindex grid (arrows / Home / End); Enter or click emits `cellSelect`.
 */
@Component({
  selector: 'ap-status-matrix',
  imports: [DatePipe],
  templateUrl: './status-matrix.component.html',
  styleUrl: './status-matrix.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusMatrixComponent {
  readonly groups = input.required<readonly MatrixGroup[]>();
  readonly days = input.required<readonly IsoDate[]>();
  readonly today = input.required<IsoDate>();
  readonly metricLabels = input.required<readonly string[]>();
  readonly label = input('Status matrix');
  readonly cellSelect = output<MatrixSelection>();

  private readonly table = viewChild.required<ElementRef<HTMLElement>>('table');
  private readonly focused = signal<string | null>(null);

  /** Exactly one cell is tabbable: the last focused one if still present, else the first. */
  protected readonly tabStop = computed(() => {
    const groups = this.groups();
    const ids = new Set(groups.flatMap((g) => g.rows.map((r) => r.id)));
    const f = this.focused();
    if (f && ids.has(f.split('|')[0] ?? '')) return f;
    const first = groups[0]?.rows[0];
    return first ? `${first.id}|0` : null;
  });

  /** Sticky right offset (rem) for metric column `i` — the last column sits at 0. */
  protected metricRight(i: number): number {
    return (this.metricLabels().length - 1 - i) * METRIC_COL_REM;
  }

  protected key(row: MatrixRow, col: number): string {
    return `${row.id}|${col}`;
  }

  protected onFocus(row: MatrixRow, col: number): void {
    this.focused.set(this.key(row, col));
  }

  protected onKey(event: KeyboardEvent): void {
    const cell = (event.target as HTMLElement).closest<HTMLElement>('button[data-col]');
    if (!cell) return;
    const rows = [...this.table().nativeElement.querySelectorAll<HTMLElement>('tr[data-row]')];
    let r = rows.indexOf(cell.closest('tr') as HTMLElement);
    let c = Number(cell.dataset['col']);
    const last = this.days().length - 1;
    switch (event.key) {
      case 'ArrowRight': c = Math.min(c + 1, last); break;
      case 'ArrowLeft': c = Math.max(c - 1, 0); break;
      case 'ArrowDown': r = Math.min(r + 1, rows.length - 1); break;
      case 'ArrowUp': r = Math.max(r - 1, 0); break;
      case 'Home': c = 0; break;
      case 'End': c = last; break;
      default: return;
    }
    event.preventDefault();
    rows[r]?.querySelector<HTMLElement>(`button[data-col="${c}"]`)?.focus();
  }
}
