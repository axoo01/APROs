import { ChangeDetectionStrategy, Component, type ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import type { Role } from '../../../domain';
import { DemoDataPort } from '../../../data/ports/demo-data.port';
import { ClickOutsideDirective } from '../../../shared/directives/click-outside.directive';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { IconComponent, type IconName } from '../../../shared/components/icon/icon.component';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { errorMessage } from '../../../shared/utils/error-message.util';
import { AuthService } from '../../auth/auth.service';
import { APP_CONFIG } from '../../config/app-config.token';
import { ReferenceDataStore } from '../../state/reference-data.store';
import { ThemeService, type ThemePreference } from '../../theme/theme.service';

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Admin', COACH: 'Coach' };

@Component({
  selector: 'ap-user-menu',
  imports: [AvatarComponent, IconComponent, ClickOutsideDirective, ConfirmDialogComponent],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserMenuComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly demoData = inject(DemoDataPort);
  private readonly refs = inject(ReferenceDataStore);
  protected readonly theme = inject(ThemeService);
  protected readonly config = inject(APP_CONFIG);

  protected readonly open = signal(false);
  protected readonly confirmReset = signal(false);
  protected readonly session = this.auth.session;
  protected readonly title = computed(() => this.refs.currentUser()?.title ?? this.roleLabel());
  protected readonly roleLabel = computed(() => {
    const r = this.auth.role();
    return r ? ROLE_LABEL[r] : '';
  });
  private readonly otherRole = computed<Role>(() => (this.auth.role() === 'ADMIN' ? 'COACH' : 'ADMIN'));
  protected readonly otherRoleLabel = computed(() => (this.otherRole() === 'ADMIN' ? 'Head of Coaches (Admin)' : 'Coach'));

  protected readonly themeOptions: readonly { value: ThemePreference; label: string; icon: IconName }[] = [
    { value: 'system', label: 'Auto', icon: 'monitor' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
  ];

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');

  protected toggle(): void {
    this.open.update((o) => !o);
    if (this.open()) queueMicrotask(() => this.items()[0]?.focus());
  }

  /** WAI-ARIA menu keyboard model: arrows/Home/End move focus, Esc closes, Tab leaves. */
  protected onMenuKey(e: KeyboardEvent): void {
    const items = this.items();
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const focus = (i: number) => items[(i + items.length) % items.length]?.focus();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focus(idx + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focus(idx - 1);
        break;
      case 'Home':
        e.preventDefault();
        focus(0);
        break;
      case 'End':
        e.preventDefault();
        focus(items.length - 1);
        break;
      case 'Escape':
        this.open.set(false);
        this.trigger().nativeElement.focus();
        break;
      case 'Tab':
        this.open.set(false);
        break;
    }
  }

  private items(): HTMLElement[] {
    const root = this.menu()?.nativeElement;
    return root ? Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"], [role="radio"]')) : [];
  }

  protected switchRole(): void {
    this.open.set(false);
    this.auth.switchRole(this.otherRole()).subscribe({
      next: (s) => {
        this.toasts.show({ tone: 'success', message: `Now viewing as ${s.fullName} (${ROLE_LABEL[s.role]}).` });
        // Re-run guards: the new role may not have access to the current page.
        void this.router.navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload' });
      },
      error: (err: unknown) => this.toasts.show({ tone: 'danger', message: errorMessage(err) }),
    });
  }

  protected reset(): void {
    this.demoData.reset().subscribe({
      next: () => this.toasts.show({ tone: 'success', message: 'Demo data restored.' }),
      error: (err: unknown) => this.toasts.show({ tone: 'danger', message: errorMessage(err) }),
    });
  }

  protected logout(): void {
    this.open.set(false);
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}
