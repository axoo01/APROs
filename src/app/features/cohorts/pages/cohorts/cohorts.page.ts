import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CohortContextStore } from '../../../../core/state/cohort-context.store';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { PhasePillComponent } from '../../../../shared/components/phase-pill/phase-pill.component';

/** Admin-only. Cohort creation/editing UI lands in a later milestone; naming rules are already enforced by the data layer. */
@Component({
  selector: 'ap-cohorts-page',
  imports: [DatePipe, IconComponent, PageHeaderComponent, PhasePillComponent],
  templateUrl: './cohorts.page.html',
  styleUrl: './cohorts.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CohortsPage {
  protected readonly ctx = inject(CohortContextStore);
}
