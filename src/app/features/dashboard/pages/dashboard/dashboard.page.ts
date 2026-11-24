import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { DashboardFacade } from '../../data-access/dashboard.facade';

@Component({
  selector: 'ap-dashboard-page',
  imports: [PercentPipe, AvatarComponent, IconComponent, PageHeaderComponent],
  providers: [DashboardFacade],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly f = inject(DashboardFacade);
  protected readonly tag = colorTagVar;
  protected readonly round = Math.round;
}
