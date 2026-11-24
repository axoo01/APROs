import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { describePhase, type CohortPhase } from '../../../domain';

const TONES: Record<CohortPhase['kind'], string> = {
  UPCOMING: 'bg-surface-2 text-fg-muted',
  PHASE_1: 'bg-accent-soft text-accent',
  INTERMISSION: 'bg-warning-soft text-warning',
  PHASE_2: 'bg-info-soft text-info',
  COMPLETED: 'bg-success-soft text-success',
};

@Component({
  selector: 'ap-phase-pill',
  templateUrl: './phase-pill.component.html',
  styleUrl: './phase-pill.component.css',
  host: {
    class: 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
    '[class]': 'tone()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhasePillComponent {
  readonly phase = input.required<CohortPhase>();
  protected readonly label = computed(() => describePhase(this.phase()));
  protected readonly tone = computed(() => TONES[this.phase().kind]);
}
