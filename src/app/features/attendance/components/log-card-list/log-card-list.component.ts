import { DatePipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { Id, IsoDate } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { cellDescription, cellTone, type CellSelection } from '../../attendance-cell.const';
import type { LogGroup, LogRow } from '../../data-access/attendance-log.facade';

/** Phone layout of the matrix: one compact card per apprentice with a day strip; expand to edit days. */
@Component({
  selector: 'ap-log-card-list',
  imports: [DatePipe, PercentPipe, IconComponent],
  templateUrl: './log-card-list.component.html',
  styleUrl: './log-card-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogCardListComponent {
  readonly groups = input.required<readonly LogGroup[]>();
  readonly today = input.required<IsoDate>();
  readonly cellSelect = output<CellSelection>();

  protected readonly tone = cellTone;
  protected readonly describe = cellDescription;
  protected readonly tagColor = colorTagVar;
  protected readonly expanded = signal<ReadonlySet<Id>>(new Set());

  protected toggle(row: LogRow): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (!next.delete(row.id)) next.add(row.id);
      return next;
    });
  }
}
