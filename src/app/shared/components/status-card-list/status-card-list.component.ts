import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { Id, IsoDate } from '../../../domain';
import { IconComponent } from '../icon/icon.component';
import type { MatrixGroup, MatrixRow, MatrixSelection } from '../status-matrix/status-matrix.component';

/** Phone layout of the status matrix: one card per row with a day strip; expand to tap individual days. */
@Component({
  selector: 'ap-status-card-list',
  imports: [DatePipe, IconComponent],
  templateUrl: './status-card-list.component.html',
  styleUrl: './status-card-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusCardListComponent {
  readonly groups = input.required<readonly MatrixGroup[]>();
  readonly today = input.required<IsoDate>();
  /** Short labels for the first two metrics, e.g. ['Att', 'Punct']. */
  readonly metricLabels = input.required<readonly string[]>();
  readonly cellSelect = output<MatrixSelection>();

  protected readonly expanded = signal<ReadonlySet<Id>>(new Set());

  protected toggle(row: MatrixRow): void {
    this.expanded.update((s) => {
      const next = new Set(s);
      if (!next.delete(row.id)) next.add(row.id);
      return next;
    });
  }
}
