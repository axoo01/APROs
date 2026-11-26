import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import type { UpsertSprintInput } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ApprenticePassportComponent } from '../../../../shared/components/apprentice-passport/apprentice-passport.component';
import { HealthKpisComponent } from '../../components/health-kpis/health-kpis.component';
import { RiskRadarComponent } from '../../components/risk-radar/risk-radar.component';
import { SpecHealthMatrixComponent } from '../../components/spec-health-matrix/spec-health-matrix.component';
import { SprintMarkDialogComponent } from '../../components/sprint-mark-dialog/sprint-mark-dialog.component';
import { SprintTableComponent } from '../../components/sprint-table/sprint-table.component';
import { StandoutsCardComponent } from '../../components/standouts-card/standouts-card.component';
import { CohortHealthStore } from '../../../../core/state/cohort-health.store';
import { DashboardFacade } from '../../data-access/dashboard.facade';

/** Master Dashboard: composite health KPIs, early-warning radar, standouts, track matrix (+ sprint delivery in Phase 2), 360° passport. */
@Component({
  selector: 'ap-dashboard-page',
  imports: [
    IconComponent,
    PageHeaderComponent,
    ApprenticePassportComponent,
    HealthKpisComponent,
    RiskRadarComponent,
    SpecHealthMatrixComponent,
    SprintMarkDialogComponent,
    SprintTableComponent,
    StandoutsCardComponent,
  ],
  providers: [CohortHealthStore, DashboardFacade],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly f = inject(DashboardFacade);
  protected readonly sprintDialogOpen = signal(false);

  protected saveSprint(input: UpsertSprintInput): void {
    this.f.logSprintMark(input);
  }

  protected copyBrief(): void {
    void this.f.copyBrief();
  }
}
