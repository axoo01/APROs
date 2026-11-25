import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent, type IconName } from '../icon/icon.component';

/**
 * Sticky end-of-sweep action shared by sweep-style screens (attendance, EOD).
 * Rendered by the page only while items remain.
 */
@Component({
  selector: 'ap-closeout-bar',
  imports: [IconComponent],
  templateUrl: './closeout-bar.component.html',
  styleUrl: './closeout-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloseoutBarComponent {
  readonly remaining = input.required<number>();
  readonly total = input.required<number>();
  /** e.g. "not here", "not logged" — completes "X of Y still …". */
  readonly pendingLabel = input.required<string>();
  /** Outcome applied to the remainder, e.g. "Absent", "On Pace". */
  readonly outcome = input.required<string>();
  readonly icon = input<IconName>('check');
  readonly disabled = input(false);
  readonly closeout = output<void>();
}
