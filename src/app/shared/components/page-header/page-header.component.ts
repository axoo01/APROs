import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'ap-page-header',
  imports: [RouterLink, IconComponent],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.css',
  host: { class: 'mb-6 flex flex-wrap items-end justify-between gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
  /** Turns the eyebrow into an underlined link (e.g. back to a parent view). */
  readonly eyebrowLink = input<string | null>(null);
}
