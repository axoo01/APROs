import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { sprintBand, type Id, type SprintNumber } from '../../../../domain';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import type { ApprenticeHealth } from '../../../../core/state/cohort-health.store';
import { SPRINT_TONE } from '../../../../shared/utils/health-tier.const';

/** Phase 2 view: Sprint 1–4 delivery per apprentice (score chip + project), cohort averages, admin log action. */
@Component({
  selector: 'ap-sprint-table',
  imports: [AvatarComponent, IconComponent],
  templateUrl: './sprint-table.component.html',
  styleUrl: './sprint-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintTableComponent {
  readonly rows = input.required<readonly ApprenticeHealth[]>();
  readonly sprintNumbers = input.required<readonly SprintNumber[]>();
  readonly columnAverages = input.required<readonly (number | null)[]>();
  readonly canLog = input(false);
  readonly openPassport = output<Id>();
  readonly logMark = output<void>();

  protected tone(score: number): string {
    return SPRINT_TONE[sprintBand(score)];
  }
}
