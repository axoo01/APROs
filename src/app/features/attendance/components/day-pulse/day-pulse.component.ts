import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { STATUS_LABELS, type AttendanceStatus, type AttendanceSummary } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { STATUS_TONE } from '../../attendance-status.const';
import type { ActivityEntry } from '../../data-access/attendance.facade';
import { StatusDonutComponent } from '../status-donut/status-donut.component';

const SHORTCUTS: readonly { keys: readonly string[]; label: string }[] = [
  { keys: ['Enter'], label: 'Present (again → Late)' },
  { keys: ['P', 'L', 'A', 'E'], label: 'Set status' },
  { keys: ['D'], label: 'Details & note' },
  { keys: ['↑', '↓'], label: 'Move between cards' },
  { keys: ['/'], label: 'Search' },
  { keys: ['Ctrl', 'Z'], label: 'Undo' },
];

/** Desktop side rail: live sweep progress, today's P/L/A/E, recent changes with undo, shortcuts. */
@Component({
  selector: 'ap-day-pulse',
  imports: [PercentPipe, IconComponent, StatusDonutComponent],
  templateUrl: './day-pulse.component.html',
  styleUrl: './day-pulse.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayPulseComponent {
  readonly summary = input.required<AttendanceSummary>();
  readonly swept = input.required<number>();
  readonly total = input.required<number>();
  readonly recent = input.required<readonly ActivityEntry[]>();
  readonly undo = output<number>();

  protected readonly shortcuts = SHORTCUTS;
  protected readonly rows = computed(() => {
    const s = this.summary();
    return (['P', 'L', 'A', 'E'] as const satisfies readonly AttendanceStatus[]).map((k) => ({
      key: k,
      label: STATUS_LABELS[k],
      count: s[k],
      tone: STATUS_TONE[k].soft,
    }));
  });

  protected dot(status: AttendanceStatus | null): string {
    return status ? STATUS_TONE[status].solid : 'bg-surface-2';
  }
}
