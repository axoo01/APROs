import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { APP_CONFIG } from '../../config/app-config.token';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { LogoComponent } from '../../../shared/components/logo/logo.component';
import { NavigationStore } from '../navigation/navigation.store';

@Component({
  selector: 'ap-side-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent, LogoComponent],
  templateUrl: './side-nav.component.html',
  styleUrl: './side-nav.component.css',
  host: { class: 'sticky top-0 h-dvh flex-col bg-brand-panel' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideNavComponent {
  protected readonly nav = inject(NavigationStore);
  protected readonly config = inject(APP_CONFIG);
}
