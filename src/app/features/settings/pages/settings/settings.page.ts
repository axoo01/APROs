import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { APP_CONFIG } from '../../../../core/config/app-config.token';
import { Clock } from '../../../../core/platform/clock.service';
import { ThemeService, type ThemePreference } from '../../../../core/theme/theme.service';
import { DemoDataPort } from '../../../../data/ports/demo-data.port';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { errorMessage } from '../../../../shared/utils/error-message.util';

@Component({
  selector: 'ap-settings-page',
  imports: [DatePipe, ConfirmDialogComponent, IconComponent, PageHeaderComponent],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  protected readonly theme = inject(ThemeService);
  protected readonly demoData = inject(DemoDataPort);
  protected readonly config = inject(APP_CONFIG);
  private readonly toasts = inject(ToastService);

  protected readonly confirm = signal(false);
  protected readonly today = inject(Clock).today;
  protected readonly themes: readonly { value: ThemePreference; label: string }[] = [
    { value: 'system', label: 'Auto' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  protected reset(): void {
    this.demoData.reset().subscribe({
      next: () => this.toasts.show({ tone: 'success', message: 'Demo data restored.' }),
      error: (err: unknown) => this.toasts.show({ tone: 'danger', message: errorMessage(err) }),
    });
  }
}
