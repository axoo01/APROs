import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { IsoDate } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SegmentedBarComponent, type BarSegment } from '../../../../shared/components/segmented-bar/segmented-bar.component';
import { StatusCardListComponent } from '../../../../shared/components/status-card-list/status-card-list.component';
import {
  StatusMatrixComponent,
  type MatrixSelection,
} from '../../../../shared/components/status-matrix/status-matrix.component';
import type { EodTrack } from '../../data-access/eod-log.facade';

/**
 * One specialization in the EOD log: a summary header (count, segmented status bar, On Pace %, support/blocked pills)
 * that expands into that track's daily matrix (desktop) or day-strip cards (phone).
 */
@Component({
  selector: 'ap-eod-track-section',
  imports: [PercentPipe, IconComponent, SegmentedBarComponent, StatusCardListComponent, StatusMatrixComponent],
  templateUrl: './eod-track-section.component.html',
  styleUrl: './eod-track-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EodTrackSectionComponent {
  readonly track = input.required<EodTrack>();
  readonly expanded = input(false);
  readonly days = input.required<readonly IsoDate[]>();
  readonly today = input.required<IsoDate>();
  readonly toggleExpand = output<void>();
  readonly cellSelect = output<MatrixSelection>();

  protected readonly panelId = computed(() => `eod-track-${this.track().key}`);
  protected readonly groups = computed(() => [this.track().matrix]);
  protected readonly segments = computed<readonly BarSegment[]>(() => {
    const s = this.track().stats;
    return [
      { key: 'op', label: 'On Pace', value: s.onPace, tone: 'bg-success' },
      { key: 'ns', label: 'Needs Support', value: s.needsSupport, tone: 'bg-status-l' },
      { key: 'bl', label: 'Blocked', value: s.blocked, tone: 'bg-danger' },
      { key: 'none', label: 'Not logged', value: s.unlogged, tone: 'bg-line' },
    ];
  });
}
