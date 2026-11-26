import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HEALTH_TIER_LABELS, onPaceRate, type EodTally, type Id } from '../../../../domain';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import type { ApprenticeHealth } from '../../../../core/state/cohort-health.store';
import type { BlockerCallout, DashboardFocus, ViewAllLink } from '../../data-access/dashboard.facade';
import { TIER_TONE } from '../../../../shared/utils/health-tier.const';

/** The dashboard shows the most severe few; the full list lives on Apprentices (or the logs). */
const PREVIEW_ROWS = 3;

/**
 * Early-warning feed: At Risk + Silent Drift with a plain-English reason (or, when a KPI is toggled,
 * the filtered/ranked list), plus systemic blocker callouts. Rows open the 360° passport.
 */
@Component({
  selector: 'ap-risk-radar',
  imports: [PercentPipe, RouterLink, AvatarComponent, IconComponent],
  templateUrl: './risk-radar.component.html',
  styleUrl: './risk-radar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiskRadarComponent {
  readonly entries = input.required<readonly ApprenticeHealth[]>();
  readonly heading = input.required<string>();
  readonly focus = input<DashboardFocus | null>(null);
  readonly blockers = input<readonly BlockerCallout[]>([]);
  readonly viewAll = input<ViewAllLink | null>(null);
  readonly openPassport = output<Id>();
  readonly clearFocus = output<void>();

  protected readonly tierLabels = HEALTH_TIER_LABELS;
  protected readonly tierTone = TIER_TONE;
  protected readonly onPace = (t: EodTally) => onPaceRate(t);

  protected readonly visible = computed(() => this.entries().slice(0, PREVIEW_ROWS));
  protected readonly hidden = computed(() => Math.max(0, this.entries().length - PREVIEW_ROWS));
}
