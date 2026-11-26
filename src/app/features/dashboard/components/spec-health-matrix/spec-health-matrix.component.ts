import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Id } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import type { SpecializationHealth } from '../../data-access/dashboard.facade';

/** One compact card per specialization; tapping one filters the whole dashboard to that track (tap again to clear). */
@Component({
  selector: 'ap-spec-health-matrix',
  imports: [PercentPipe, IconComponent],
  templateUrl: './spec-health-matrix.component.html',
  styleUrl: './spec-health-matrix.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecHealthMatrixComponent {
  readonly rows = input.required<readonly SpecializationHealth[]>();
  readonly active = input<Id | null>(null);
  readonly specToggle = output<Id>();

  protected readonly tag = colorTagVar;
  protected readonly round = Math.round;
}
