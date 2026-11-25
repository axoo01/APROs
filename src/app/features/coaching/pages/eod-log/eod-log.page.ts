import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, signal, viewChild } from '@angular/core';
import type { EodMark } from '../../../../domain';
import {
  DateScopeToolbarComponent,
  LOG_PRESET_OPTIONS,
} from '../../../../shared/components/date-scope-toolbar/date-scope-toolbar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { RosterFilterBarComponent } from '../../../../shared/components/roster-filter-bar/roster-filter-bar.component';
import type { MatrixSelection } from '../../../../shared/components/status-matrix/status-matrix.component';
import { EodDrawerComponent } from '../../components/eod-drawer/eod-drawer.component';
import { EodTrackSectionComponent } from '../../components/eod-track-section/eod-track-section.component';
import { EodLogFacade, type EodKpi } from '../../data-access/eod-log.facade';

/** EOD history matrix (This Week / Last Week / Last 30 Days) with retroactive edits. */
@Component({
  selector: 'ap-eod-log-page',
  imports: [
    DateScopeToolbarComponent,
    IconComponent,
    PageHeaderComponent,
    RosterFilterBarComponent,
    EodDrawerComponent,
    EodTrackSectionComponent,
  ],
  providers: [EodLogFacade],
  templateUrl: './eod-log.page.html',
  styleUrl: './eod-log.page.css',
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EodLogPage {
  protected readonly f = inject(EodLogFacade);
  private readonly locale = inject(LOCALE_ID);
  private readonly filterBar = viewChild.required(RosterFilterBarComponent);

  /** EOD has no single-day view: the matrix already shows each day. */
  protected readonly presets = LOG_PRESET_OPTIONS.filter((p) => p.value !== 'DAY');

  /** KPI cards: each filters and/or ranks the tracks below (worst first). */
  protected readonly kpis = computed(() => {
    const t = this.f.tally();
    const cards: { key: EodKpi; label: string; value: string; tone: string; hint: string; activeHint: string; title: string }[] = [
      {
        key: 'ON_PACE',
        label: 'On pace',
        value: t.total ? `${Math.round(this.f.onPace() * 100)}%` : '—',
        tone: '',
        hint: `${t.total} rated days · tap to rank`,
        activeHint: 'Lowest first · tap to clear',
        title: 'Rank apprentices by lowest On Pace share',
      },
      {
        key: 'NEEDS_SUPPORT',
        label: 'Needs support',
        value: String(t.NEEDS_SUPPORT),
        tone: 'text-warning',
        hint: 'days · tap to filter',
        activeHint: 'Most first · tap to clear',
        title: 'Only apprentices with Needs Support days, most first',
      },
      {
        key: 'BLOCKED',
        label: 'Blocked',
        value: String(t.BLOCKED),
        tone: 'text-danger',
        hint: 'days · tap to filter',
        activeHint: 'Most first · tap to clear',
        title: 'Only apprentices with Blocked days, most first',
      },
      {
        key: 'BEHIND',
        label: 'Behind',
        value: String(this.f.followUpCount()),
        tone: '',
        hint: 'with a 2+ day streak · tap to filter',
        activeHint: 'Longest streak first · tap to clear',
        title: '2+ consecutive Needs Support / Blocked days in this period',
      },
    ];
    return cards;
  });

  protected readonly editing = signal<MatrixSelection | null>(null);
  protected readonly editTarget = computed(() => {
    const e = this.editing();
    return e ? this.f.target(e.rowId, e.date) : null;
  });

  protected readonly subtitle = computed(() => {
    const days = this.f.days();
    const first = days[0];
    const last = days.at(-1);
    const cohort = this.f.cohort()?.displayName ?? '';
    const fmt = (d: string) => formatDate(d, 'EEE, d MMM', this.locale);
    const range = !first || !last ? 'No working days in range' : first === last ? fmt(first) : `${fmt(first)} – ${fmt(last)} · ${days.length} working days`;
    return cohort ? `${range} · ${cohort}` : range;
  });

  protected onSave(mark: EodMark): void {
    const e = this.editing();
    if (e) this.f.setMark(e.rowId, e.date, mark);
  }

  protected onClear(): void {
    const e = this.editing();
    if (e) this.f.setMark(e.rowId, e.date, null);
  }

  protected onGlobalKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
    if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.filterBar().focusSearch();
    }
  }
}
