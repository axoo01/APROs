import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

/** Sticky end-of-sweep action. Rendered by the page only while someone is still "Not Here Yet". */
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
  readonly disabled = input(false);
  readonly closeout = output<void>();
}
