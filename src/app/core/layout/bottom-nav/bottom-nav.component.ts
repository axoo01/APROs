import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { NavigationStore } from '../navigation/navigation.store';

@Component({
  selector: 'ap-bottom-nav',
  imports: [RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.css',
  host: { class: 'fixed inset-x-0 bottom-0 z-30 block px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BottomNavComponent {
  protected readonly nav = inject(NavigationStore);
}
