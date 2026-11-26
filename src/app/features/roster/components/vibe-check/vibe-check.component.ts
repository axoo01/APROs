import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { onPaceRate, type EodTally } from '../../../../domain';
import type { ApprenticeHealth } from '../../../../core/state/cohort-health.store';
import { RATING_TONE } from '../../../../shared/utils/behavior-rating.const';

/** Rate pill tone: strong ≥ 90%, okay ≥ 80%, otherwise flagged. */
function rateTone(rate: number): string {
  if (rate >= 0.9) return 'bg-success-soft text-success';
  if (rate >= 0.8) return 'bg-surface-2 text-fg-muted';
  return 'bg-danger-soft text-danger';
}

/** "Vibe check": three fixed-width slots (Att · EOD OP · latest behavior) so rows align; missing data keeps a dashed slot. */
@Component({
  selector: 'ap-vibe-check',
  imports: [PercentPipe],
  templateUrl: './vibe-check.component.html',
  styleUrl: './vibe-check.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VibeCheckComponent {
  readonly entry = input.required<ApprenticeHealth | null>();

  protected readonly ratingTone = RATING_TONE;
  protected readonly rateTone = rateTone;
  protected readonly onPace = (t: EodTally) => onPaceRate(t);
}
