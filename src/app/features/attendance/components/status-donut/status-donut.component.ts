import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { AttendanceStatus, AttendanceTally } from '../../../../domain';
import { STATUS_COLOR } from '../../attendance-status.const';

const R = 42;
const C = 2 * Math.PI * R;
const ORDER: readonly AttendanceStatus[] = ['P', 'L', 'A', 'E'];

/**
 * P/L/A/E donut. With `of` set, the unrecorded remainder is drawn as the track (sweep progress);
 * otherwise segments fill the ring. Decorative — callers provide the accessible text.
 */
@Component({
  selector: 'ap-status-donut',
  templateUrl: './status-donut.component.html',
  styleUrl: './status-donut.component.css',
  host: { class: 'relative inline-grid place-items-center', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusDonutComponent {
  readonly tally = input.required<AttendanceTally>();
  /** Denominator for progress mode (e.g. roster size). Defaults to the tally total. */
  readonly of = input<number | null>(null);
  readonly size = input(160);
  readonly thickness = input(10);

  protected readonly r = R;
  protected readonly circumference = C;

  protected readonly segments = computed(() => {
    const t = this.tally();
    const total = Math.max(this.of() ?? t.total, 1);
    let offset = 0;
    return ORDER.filter((k) => t[k] > 0).map((k) => {
      const len = (t[k] / total) * C;
      const seg = { key: k, dash: `${len} ${C - len}`, offset: -offset, color: STATUS_COLOR[k] };
      offset += len;
      return seg;
    });
  });
}
