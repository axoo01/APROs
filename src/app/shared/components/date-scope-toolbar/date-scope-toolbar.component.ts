import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { IsoDate, LogPreset } from '../../../domain';
import { IconComponent } from '../icon/icon.component';

export interface PresetOption {
  readonly value: LogPreset;
  readonly label: string;
  /** Phone label. */
  readonly short: string;
}

/** All log presets; screens pass the subset they support. */
export const LOG_PRESET_OPTIONS: readonly PresetOption[] = [
  { value: 'THIS_WEEK', label: 'This Week', short: 'This wk' },
  { value: 'LAST_WEEK', label: 'Last Week', short: 'Last wk' },
  { value: 'LAST_30_DAYS', label: 'Last 30 Days', short: '30 days' },
  { value: 'DAY', label: 'Single Day', short: 'Day' },
];

/** Log time scope: preset pills, optional single-day picker (prev/next) and an optional export action. */
@Component({
  selector: 'ap-date-scope-toolbar',
  imports: [IconComponent],
  templateUrl: './date-scope-toolbar.component.html',
  styleUrl: './date-scope-toolbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateScopeToolbarComponent {
  readonly presets = input<readonly PresetOption[]>(LOG_PRESET_OPTIONS);
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


  protected onDate(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) this.dayChange.emit(value as IsoDate);
  }
}
