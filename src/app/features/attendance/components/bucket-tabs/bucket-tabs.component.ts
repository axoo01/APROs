import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { BUCKET_LABELS, type AttendanceBucket, type AttendanceSummary } from '../../../../domain';

const ORDER: readonly AttendanceBucket[] = ['NOT_HERE_YET', 'PRESENT', 'ABSENT_EXCUSED'];

const TONE: Record<AttendanceBucket, { active: string; dot: string }> = {
  NOT_HERE_YET: { active: 'bg-action text-on-action', dot: 'bg-accent' },
  PRESENT: { active: 'bg-status-p text-on-status-p', dot: 'bg-status-p' },
  ABSENT_EXCUSED: { active: 'bg-status-a text-on-status-a', dot: 'bg-status-a' },
};

/** The three Sweep buckets as a WAI-ARIA tablist with live counts (roving tabindex, arrow keys). */
@Component({
  selector: 'ap-bucket-tabs',
  templateUrl: './bucket-tabs.component.html',
  styleUrl: './bucket-tabs.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BucketTabsComponent {
  readonly counts = input.required<Readonly<Record<AttendanceBucket, number>>>();
  readonly summary = input.required<AttendanceSummary>();
  readonly panelId = input.required<string>();
  readonly active = model.required<AttendanceBucket>();

  protected readonly tabs = computed(() => {
    const c = this.counts();
    const s = this.summary();
    const hints: Record<AttendanceBucket, string> = {
      NOT_HERE_YET: 'Tap to mark',
      PRESENT: `P ${s.P} · L ${s.L}`,
      ABSENT_EXCUSED: `A ${s.A} · E ${s.E}`,
    };
    return ORDER.map((key) => ({ key, label: BUCKET_LABELS[key], count: c[key], hint: hints[key], ...TONE[key] }));
  });

  protected tabId(key: AttendanceBucket): string {
    return `bucket-tab-${key}`;
  }

  protected onKey(event: KeyboardEvent): void {
    const i = ORDER.indexOf(this.active());
    const next =
      event.key === 'ArrowRight' ? (i + 1) % ORDER.length
      : event.key === 'ArrowLeft' ? (i - 1 + ORDER.length) % ORDER.length
      : event.key === 'Home' ? 0
      : event.key === 'End' ? ORDER.length - 1
      : -1;
    const key = ORDER[next];
    if (!key) return;
    event.preventDefault();
    this.active.set(key);
    document.getElementById(this.tabId(key))?.focus();
  }
}
