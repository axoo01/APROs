import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface BarSegment {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** Background utility class, e.g. `bg-success`. */
  readonly tone: string;
}

/** Horizontal proportion bar (e.g. On Pace / Needs Support / Blocked / unlogged). Accessible as one labelled image. */
@Component({
  selector: 'ap-segmented-bar',
  templateUrl: './segmented-bar.component.html',
  styleUrl: './segmented-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentedBarComponent {
  readonly segments = input.required<readonly BarSegment[]>();

  private readonly total = computed(() => this.segments().reduce((n, s) => n + s.value, 0));
  protected readonly parts = computed(() => {
    const total = this.total();
    return this.segments()
      .filter((s) => s.value > 0)
      .map((s) => ({ ...s, pct: total ? (s.value / total) * 100 : 0 }));
  });
  protected readonly label = computed(() => this.segments().map((s) => `${s.label} ${s.value}`).join(', '));
}
