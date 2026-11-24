import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';
import { SideNavComponent } from '../side-nav/side-nav.component';
import { TopBarComponent } from '../top-bar/top-bar.component';

/**
 * Adaptive shell. Mobile: glass top bar + bottom tab bar. Desktop (lg+): brand side rail + top bar.
 */
@Component({
  selector: 'ap-app-shell',
  imports: [RouterOutlet, SideNavComponent, TopBarComponent, BottomNavComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {}
