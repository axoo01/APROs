import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ap-page-header',
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.css',
  host: { class: 'mb-6 flex flex-wrap items-end justify-between gap-4' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
}
