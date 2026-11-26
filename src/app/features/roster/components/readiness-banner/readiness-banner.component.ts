import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { SegmentedBarComponent, type BarSegment } from '../../../../shared/components/segmented-bar/segmented-bar.component';

export interface ReadinessCounts {
  readonly total: number;
  readonly ready: number;
  readonly needsPairing: number;
  readonly readyRate: number;
}

/** One-line Phase 2 forecast: headline, segmented bar, "View Full Report" toggle and CSV export. */
@Component({
  selector: 'ap-readiness-banner',
  imports: [PercentPipe, IconComponent, SegmentedBarComponent],
  templateUrl: './readiness-banner.component.html',
  styleUrl: './readiness-banner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadinessBannerComponent {
  readonly counts = input.required<ReadinessCounts>();
  readonly expanded = input(false);
  readonly scopeLabel = input<string | null>(null);
  readonly toggleReport = output<void>();
  readonly exportReport = output<void>();

  protected readonly segments = computed<readonly BarSegment[]>(() => [
    { key: 'ready', label: 'Ready', value: this.counts().ready, tone: 'bg-success' },
    { key: 'pairing', label: 'Needs Pairing Support', value: this.counts().needsPairing, tone: 'bg-status-l' },
  ]);
}
