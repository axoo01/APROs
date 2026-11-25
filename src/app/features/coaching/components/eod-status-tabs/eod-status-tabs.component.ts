import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import type { EodBucket } from '../../data-access/eod.facade';

const TABS: readonly { key: EodBucket; label: string; short: string; active: string; dot: string }[] = [
  { key: 'NOT_LOGGED', label: 'Not Logged', short: 'To log', active: 'bg-action text-on-action', dot: 'bg-accent' },
  { key: 'ON_PACE', label: 'On Pace', short: 'On pace', active: 'bg-success text-on-status-p', dot: 'bg-success' },
  { key: 'NEEDS_SUPPORT', label: 'Needs Support', short: 'Support', active: 'bg-status-l text-on-status-l', dot: 'bg-status-l' },
  { key: 'BLOCKED', label: 'Blocked', short: 'Blocked', active: 'bg-danger text-on-status-a', dot: 'bg-danger' },
];

/** EOD pulse counters as a WAI-ARIA tablist (roving tabindex, arrow keys). */
@Component({
  selector: 'ap-eod-status-tabs',
  templateUrl: './eod-status-tabs.component.html',
  styleUrl: './eod-status-tabs.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EodStatusTabsComponent {
  readonly counts = input.required<Readonly<Record<EodBucket, number>>>();
  readonly panelId = input.required<string>();
  readonly active = model.required<EodBucket>();

  protected readonly tabs = computed(() => TABS.map((t) => ({ ...t, count: this.counts()[t.key] })));

  protected tabId(key: EodBucket): string {
    return `eod-tab-${key}`;
  }

  protected onKey(event: KeyboardEvent): void {
    const i = TABS.findIndex((t) => t.key === this.active());
    const n = TABS.length;
    const next =
      event.key === 'ArrowRight' ? (i + 1) % n
      : event.key === 'ArrowLeft' ? (i - 1 + n) % n
      : event.key === 'Home' ? 0
      : event.key === 'End' ? n - 1
      : -1;
    const key = TABS[next]?.key;
    if (!key) return;
    event.preventDefault();
    this.active.set(key);
    document.getElementById(this.tabId(key))?.focus();
  }
}
