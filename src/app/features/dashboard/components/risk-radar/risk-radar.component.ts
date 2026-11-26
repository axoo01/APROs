import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { HEALTH_TIER_LABELS, onPaceRate, type EodTally, type Id } from '../../../../domain';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import type { ApprenticeHealth } from '../../../../core/state/cohort-health.store';
import type { BlockerCallout, DashboardFocus } from '../../data-access/dashboard.facade';
import { TIER_TONE } from '../../../../shared/utils/health-tier.const';

const COLLAPSED_ROWS = 8;

/**
 * Early-warning feed: At Risk + Silent Drift with a plain-English reason (or, when a KPI is toggled,
 * the filtered/ranked list), plus systemic blocker callouts. Rows open the 360° passport.
 */
@Component({
  selector: 'ap-risk-radar',
  imports: [PercentPipe, AvatarComponent, IconComponent],
  templateUrl: './risk-radar.component.html',
  styleUrl: './risk-radar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskRadarComponent {
  readonly entries = input.required<readonly ApprenticeHealth[]>();
  readonly heading = input.required<string>();
  readonly focus = input<DashboardFocus | null>(null);
  readonly blockers = input<readonly BlockerCallout[]>([]);
  readonly openPassport = output<Id>();
  readonly clearFocus = output<void>();

  protected readonly tierLabels = HEALTH_TIER_LABELS;
  protected readonly tierTone = TIER_TONE;
  protected readonly onPace = (t: EodTally) => onPaceRate(t);

  /** Re-collapses whenever the list's meaning changes. */
  protected readonly expanded = linkedSignal({ source: this.focus, computation: () => false });
  protected readonly visible = computed(() =>
    this.expanded() ? this.entries() : this.entries().slice(0, COLLAPSED_ROWS),
  );
  protected readonly hidden = computed(() => Math.max(0, this.entries().length - COLLAPSED_ROWS));
}
