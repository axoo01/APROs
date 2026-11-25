import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';

/** Placeholder until Weekly Behavior ships (next step), so the Coaching header link never dead-ends. */
@Component({
  selector: 'ap-weekly-behavior-page',
  imports: [IconComponent, PageHeaderComponent],
  templateUrl: './weekly-behavior.page.html',
  styleUrl: './weekly-behavior.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeeklyBehaviorPage {}
