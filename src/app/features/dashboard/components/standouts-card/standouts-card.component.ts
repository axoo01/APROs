import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { onPaceRate, type EodTally, type Id } from '../../../../domain';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { RATING_TONE } from '../../../../shared/utils/behavior-rating.const';
import type { ApprenticeHealth } from '../../../../core/state/cohort-health.store';

/** Top 5 by composite score with mini signal badges; a row opens the 360° passport. */
@Component({
  selector: 'ap-standouts-card',
  imports: [PercentPipe, AvatarComponent, IconComponent],
  templateUrl: './standouts-card.component.html',
  styleUrl: './standouts-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandoutsCardComponent {
  readonly entries = input.required<readonly ApprenticeHealth[]>();
  readonly openPassport = output<Id>();

  protected readonly tag = colorTagVar;
  protected readonly ratingTone = RATING_TONE;
  protected readonly onPace = (t: EodTally) => onPaceRate(t);
}
