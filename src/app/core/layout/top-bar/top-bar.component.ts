import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CohortContextStore } from '../../state/cohort-context.store';
import { Clock } from '../../platform/clock.service';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { PhasePillComponent } from '../../../shared/components/phase-pill/phase-pill.component';
import { CohortSwitcherComponent } from '../cohort-switcher/cohort-switcher.component';
import { UserMenuComponent } from '../user-menu/user-menu.component';

@Component({
  selector: 'ap-top-bar',
  imports: [DatePipe, LogoComponent, PhasePillComponent, CohortSwitcherComponent, UserMenuComponent],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.css',
  host: { class: 'sticky top-0 z-40 block px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:px-4 lg:px-8' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBarComponent {
  protected readonly ctx = inject(CohortContextStore);
  protected readonly clock = inject(Clock);
}
