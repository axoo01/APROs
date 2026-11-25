import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { IsoDate, LogPreset } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

const PRESETS: readonly { value: LogPreset; label: string; short: string }[] = [
  { value: 'THIS_WEEK', label: 'This Week', short: 'This wk' },
  { value: 'LAST_WEEK', label: 'Last Week', short: 'Last wk' },
  { value: 'LAST_30_DAYS', label: 'Last 30 Days', short: '30 days' },
  { value: 'DAY', label: 'Single Day', short: 'Day' },
];

/** Time scope (presets + single-day picker with prev/next) and the export action. */
@Component({
  selector: 'ap-log-toolbar',
  imports: [IconComponent],
  templateUrl: './log-toolbar.component.html',
  styleUrl: './log-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogToolbarComponent {
  readonly preset = input.required<LogPreset>();
  readonly day = input.required<IsoDate>();
  readonly minDay = input.required<IsoDate>();
  readonly maxDay = input.required<IsoDate>();
  readonly canExport = input(false);
  readonly exportDisabled = input(false);

  readonly presetChange = output<LogPreset>();
  readonly dayChange = output<IsoDate>();
  readonly step = output<-1 | 1>();
  readonly export = output<void>();

  protected readonly presets = PRESETS;

  protected onDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) this.dayChange.emit(value as IsoDate);
  }
}
