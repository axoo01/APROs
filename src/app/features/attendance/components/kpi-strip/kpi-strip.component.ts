import { PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FOLLOW_UP_THRESHOLDS } from '../../../../domain';
import { IconComponent, type IconName } from '../../../../shared/components/icon/icon.component';
import type { AttendanceKpi, Kpi, LogKpis } from '../../data-access/attendance-log.facade';

type Kind = 'rate' | 'count';

interface Tile {
  readonly key: AttendanceKpi;
  readonly label: string;
  readonly kpi: Kpi;
  readonly kind: Kind;
  /** True when an increase is good (rates) — drives delta colour. */
  readonly higherIsBetter: boolean;
  readonly hint: string;
  /** What tapping does: rank worst-first, or filter. */
  readonly action: 'rank' | 'filter';
}

/** Four scoped KPI tiles with prior-period deltas; each one toggles a rank (worst first) or filter. */
@Component({
  selector: 'ap-kpi-strip',
  imports: [PercentPipe, IconComponent],
  templateUrl: './kpi-strip.component.html',
  styleUrl: './kpi-strip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiStripComponent {
  readonly kpis = input.required<LogKpis>();
  readonly priorLabel = input.required<string>();
  readonly active = input<AttendanceKpi | null>(null);
  readonly kpiToggle = output<AttendanceKpi>();

  protected readonly tiles = computed<readonly Tile[]>(() => {
    const k = this.kpis();
    return [
      {
        key: 'ATTENDANCE',
        label: 'Attendance',
        kpi: k.attendance,
        kind: 'rate',
        higherIsBetter: true,
        hint: '(P+L) ÷ (P+L+A) · E is neutral',
        action: 'rank',
      },
      { key: 'PUNCTUALITY', label: 'Punctuality', kpi: k.punctuality, kind: 'rate', higherIsBetter: true, hint: 'P ÷ (P+L)', action: 'rank' },
      {
        key: 'ABSENCES',
        label: 'Unexcused absences',
        kpi: k.absences,
        kind: 'count',
        higherIsBetter: false,
        hint: 'A marks in scope',
        action: 'filter',
      },
      {
        key: 'FOLLOW_UP',
        label: 'Needs follow-up',
        kpi: k.followUp,
        kind: 'count',
        higherIsBetter: false,
        hint: `${FOLLOW_UP_THRESHOLDS.absences}+ absences or ${FOLLOW_UP_THRESHOLDS.lates}+ lates`,
        action: 'filter',
      },
    ];
  });

  protected actionHint(t: Tile): string {
    if (this.active() === t.key) return t.action === 'rank' ? 'Lowest first · tap to clear' : 'Most first · tap to clear';
    return t.action === 'rank' ? 'Tap to rank' : 'Tap to filter';
  }

  protected deltaText(t: Tile): string {
    const d = t.kpi.delta;
    if (d === null) return 'No prior data';
    if (t.kind === 'rate') {
      const pts = Math.round(d * 1000) / 10;
      return pts === 0 ? 'No change' : `${pts > 0 ? '+' : ''}${pts} pts`;
    }
    return d === 0 ? 'No change' : `${d > 0 ? '+' : ''}${d}`;
  }

  protected deltaTone(t: Tile): string {
    const d = t.kpi.delta;
    if (d === null || Math.abs(d) < (t.kind === 'rate' ? 0.0005 : 1)) return 'text-fg-subtle';
    return d > 0 === t.higherIsBetter ? 'text-success' : 'text-danger';
  }

  protected deltaIcon(t: Tile): IconName | null {
    const d = t.kpi.delta;
    if (d === null || d === 0) return null;
    return d > 0 ? 'trending-up' : 'trending-down';
  }
}
