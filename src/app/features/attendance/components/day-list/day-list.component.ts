import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { REASON_LABELS, STATUS_LABELS, type AttendanceRecord, type IsoDate } from '../../../../domain';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { STATUS_TONE } from '../../attendance-status.const';
import type { CellSelection } from '../../attendance-cell.const';
import type { LogGroup } from '../../data-access/attendance-log.facade';

/** Single-day view: each apprentice's status, reason/note and who recorded it. Tap a row to edit. */
@Component({
  selector: 'ap-day-list',
  imports: [DatePipe, AvatarComponent, IconComponent],
  templateUrl: './day-list.component.html',
  styleUrl: './day-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DayListComponent {
  readonly groups = input.required<readonly LogGroup[]>();
  readonly day = input.required<IsoDate>();
  readonly cellSelect = output<CellSelection>();

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly reasonLabels = REASON_LABELS;
  protected readonly tones = STATUS_TONE;
  protected readonly tagColor = colorTagVar;

  /** "Traffic — note", or null when the record has neither. */
  protected detail(rec: AttendanceRecord | null): string | null {
    if (!rec) return null;
    const parts = [rec.reason ? REASON_LABELS[rec.reason] : null, rec.note].filter((p): p is string => !!p);
    return parts.length ? parts.join(' — ') : null;
  }
}
