import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { Id } from '../../../../domain';
import { IconComponent, type IconName } from '../../../../shared/components/icon/icon.component';
import type { EodEntry } from '../../data-access/eod.facade';
import { EodCardComponent } from '../eod-card/eod-card.component';

/** Collapsed, muted list of apprentices outside today's queue (absent/excused, not checked in). Overrides allowed. */
@Component({
  selector: 'ap-eod-lane-section',
  imports: [IconComponent, EodCardComponent],
  templateUrl: './eod-lane-section.component.html',
  styleUrl: './eod-lane-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EodLaneSectionComponent {
  readonly title = input.required<string>();
  readonly hint = input('');
  readonly icon = input<IconName>('user-x');
  readonly entries = input.required<readonly EodEntry[]>();
  readonly disabled = input(false);
  readonly details = output<Id>();
  readonly note = output<Id>();

  private static seq = 0;
  protected readonly open = signal(false);
  protected readonly panelId = `eod-lane-${++EodLaneSectionComponent.seq}`;
}
