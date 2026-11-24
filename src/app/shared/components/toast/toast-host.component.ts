import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IconComponent, type IconName } from '../icon/icon.component';
import { ToastService, type Toast, type ToastTone } from './toast.service';

const ICON: Record<ToastTone, IconName> = { info: 'info', success: 'check', warning: 'alert', danger: 'alert' };
const TONE: Record<ToastTone, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

@Component({
  selector: 'ap-toast-host',
  imports: [IconComponent],
  templateUrl: './toast-host.component.html',
  styleUrl: './toast-host.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
  protected icon = (t: Toast) => ICON[t.tone];
  protected tone = (t: Toast) => TONE[t.tone];

  protected runAction(t: Toast): void {
    t.action?.run();
    this.toasts.dismiss(t.id);
  }
}
