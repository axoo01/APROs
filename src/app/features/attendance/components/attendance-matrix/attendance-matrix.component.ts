import { DatePipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, type ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import type { IsoDate } from '../../../../domain';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { cellDescription, cellTone, type CellSelection } from '../../attendance-cell.const';
import type { LogCell, LogGroup, LogRow } from '../../data-access/attendance-log.facade';

/**
 * Desktop matrix: apprentices × working days, grouped by specialization, with sticky name and
 * Att % / Punct % columns. Cells are a roving-tabindex grid (arrows / Home / End); Enter opens the editor.
 */
@Component({
  selector: 'ap-attendance-matrix',
  imports: [DatePipe, PercentPipe],
  templateUrl: './attendance-matrix.component.html',
  styleUrl: './attendance-matrix.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendanceMatrixComponent {
  readonly groups = input.required<readonly LogGroup[]>();
  readonly days = input.required<readonly IsoDate[]>();
  readonly today = input.required<IsoDate>();
  readonly cellSelect = output<CellSelection>();

  protected readonly tone = cellTone;
  protected readonly tagColor = colorTagVar;
  private readonly table = viewChild.required<ElementRef<HTMLElement>>('table');

  private readonly focused = signal<string | null>(null);
  /** Exactly one cell is tabbable: the last focused one if still present, else the first. */
  protected readonly tabStop = computed(() => {
    const groups = this.groups();
    const keys = new Set(groups.flatMap((g) => g.rows.map((r) => r.id)));
    const f = this.focused();
    if (f && keys.has(f.split('|')[0] ?? '')) return f;
    const first = groups[0]?.rows[0];
    return first ? `${first.id}|0` : null;
  });

  protected key(row: LogRow, col: number): string {
    return `${row.id}|${col}`;
  }

  protected label(row: LogRow, cell: LogCell): string {
    return `${row.name}, ${cell.date}: ${cellDescription(cell.record)}`;
  }

  protected title(cell: LogCell): string {
    const by = cell.recorder ? ` · by ${cell.recorder}` : '';
    return cellDescription(cell.record) + by;
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

  protected onFocus(row: LogRow, col: number): void {
    this.focused.set(this.key(row, col));
  }
}
