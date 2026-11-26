import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent, type IconName } from '../../../../shared/components/icon/icon.component';
import type { DashboardFocus, DashboardKpis } from '../../data-access/dashboard.facade';

interface Tile {
  readonly key: DashboardFocus;
  readonly label: string;
  readonly icon: IconName;
  readonly hint: string;
}

const TILES: readonly Tile[] = [
  { key: 'HEALTH', label: 'Cohort Health', icon: 'gauge', hint: 'Tap to list thriving' },
  { key: 'ATTENDANCE', label: 'Attendance & Punctuality', icon: 'calendar-check', hint: 'Tap to rank' },
  { key: 'EOD', label: 'EOD Momentum', icon: 'trending-up', hint: 'Tap to rank' },
  { key: 'RISK', label: 'Active Risk Flags', icon: 'alert', hint: 'Tap to filter' },
];

/** Four interactive KPI cards; each toggles the radar list into a filter or ranking (tap again to clear). */
@Component({
  selector: 'ap-health-kpis',
  imports: [PercentPipe, IconComponent],
  templateUrl: './health-kpis.component.html',
  styleUrl: './health-kpis.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthKpisComponent {
  readonly kpis = input.required<DashboardKpis>();
  readonly active = input<DashboardFocus | null>(null);
  readonly kpiToggle = output<DashboardFocus>();

  protected readonly tiles = TILES;
}
