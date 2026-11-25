import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { STATUS_LABELS, type AttendanceStatus, type AttendanceSummary } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { STATUS_TONE } from '../../attendance-status.const';
import { StatusDonutComponent } from '../status-donut/status-donut.component';

/** "Day swept" state: everyone in scope is accounted for. Raw P/L/A/E counts stay visible next to the rates. */
@Component({
  selector: 'ap-day-summary',
  imports: [PercentPipe, IconComponent, StatusDonutComponent],
  templateUrl: './day-summary.component.html',
  styleUrl: './day-summary.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DaySummaryComponent {
  readonly summary = input.required<AttendanceSummary>();
  /** e.g. "Frontend · My apprentices"; null = whole cohort. */
  readonly scopeLabel = input<string | null>(null);
  readonly copyReport = output<void>();
  readonly reviewExceptions = output<void>();
  readonly reviewPresent = output<void>();

  protected readonly rows = computed(() => {
    const s = this.summary();
    return (['P', 'L', 'A', 'E'] as const satisfies readonly AttendanceStatus[]).map((k) => ({
      key: k,
      label: STATUS_LABELS[k],
      count: s[k],
      tone: STATUS_TONE[k].soft,
    }));
  });
  protected readonly exceptions = computed(() => this.summary().A + this.summary().E);
}
