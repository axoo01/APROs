import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Id } from '../../../../domain';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import type { ReadinessRow } from '../../data-access/apprentices.facade';

/** Expanded readiness breakdown: Needs Pairing Support vs Ready, with composite score and key drivers. Rows open the passport. */
@Component({
  selector: 'ap-readiness-report',
  imports: [AvatarComponent],
  templateUrl: './readiness-report.component.html',
  styleUrl: './readiness-report.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReadinessReportComponent {
  readonly needsPairing = input.required<readonly ReadinessRow[]>();
  readonly ready = input.required<readonly ReadinessRow[]>();
  readonly openPassport = output<Id>();

  protected readonly tag = colorTagVar;
  protected readonly groups = [
    { key: 'pairing', title: 'Needs Pairing Support', tone: 'text-warning', chip: 'bg-warning-soft text-warning' },
    { key: 'ready', title: 'Ready', tone: 'text-success', chip: 'bg-success-soft text-success' },
  ] as const;

  protected rowsOf(key: 'pairing' | 'ready'): readonly ReadinessRow[] {
    return key === 'pairing' ? this.needsPairing() : this.ready();
  }
}
