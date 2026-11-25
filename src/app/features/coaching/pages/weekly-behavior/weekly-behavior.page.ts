import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, computed, effect, inject, signal, viewChild } from '@angular/core';
import { BEHAVIOR_DEFINITIONS, type CohortWeek, type IsoDate } from '../../../../domain';
import { CloseoutBarComponent } from '../../../../shared/components/closeout-bar/closeout-bar.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { RosterFilterBarComponent } from '../../../../shared/components/roster-filter-bar/roster-filter-bar.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { BehaviorCardComponent, type RateEvent } from '../../components/behavior-card/behavior-card.component';
import { BehaviorFacade, type BehaviorKpi } from '../../data-access/behavior.facade';

const CLOSEOUT_DOCK_PX = 76;
const NAMES_PREVIEW = 6;

/** Weekly behavior: week switcher, KPI filter cards, apprentice cards with weekly context, +M closeout. */
@Component({
  selector: 'ap-weekly-behavior-page',
  imports: [
    BehaviorCardComponent,
    CloseoutBarComponent,
    ConfirmDialogComponent,
    IconComponent,
    PageHeaderComponent,
    RosterFilterBarComponent,
  ],
  providers: [BehaviorFacade],
  templateUrl: './weekly-behavior.page.html',
  styleUrl: './weekly-behavior.page.css',
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeeklyBehaviorPage {
  protected readonly f = inject(BehaviorFacade);
  private readonly toasts = inject(ToastService);
  private readonly locale = inject(LOCALE_ID);
  private readonly filterBar = viewChild.required(RosterFilterBarComponent);

  protected readonly tagColor = colorTagVar;
  protected readonly plusMNote = BEHAVIOR_DEFINITIONS['+M'];
  protected readonly closeoutOpen = signal(false);
  protected readonly showCloseout = computed(() => this.f.remaining().length > 0);

  protected readonly subtitle = computed(() => {
    const w = this.f.week();
    const cohort = this.f.cohort()?.displayName ?? '';
    if (!w) return cohort;
    const range = `${formatDate(w.start, 'EEE d', this.locale)} – ${formatDate(w.end, 'EEE d MMM', this.locale)}`;
    return `Week ${w.number} · ${range}${cohort ? ' · ' + cohort : ''}`;
  });

  protected readonly kpis = computed(() => {
    const c = this.f.counts();
    const cards: { key: BehaviorKpi; label: string; value: number; tone: string }[] = [
      { key: 'UNRATED', label: 'Unrated', value: c.UNRATED, tone: '' },
      { key: 'POSITIVE', label: 'Positive (+H / +M / +L)', value: c.POSITIVE, tone: 'text-success' },
      { key: 'FLAGGED', label: 'Flagged (−H / −M / −L)', value: c.FLAGGED, tone: 'text-warning' },
      { key: 'URGENT', label: 'Needs urgent attention (−L)', value: c.URGENT, tone: 'text-danger' },
    ];
    return cards;
  });

  /** "Ama, Kofi, … +5 more" for the closeout confirmation. */
  protected readonly remainingNames = computed(() => {
    const names = this.f.remaining().map((e) => e.name);
    const shown = names.slice(0, NAMES_PREVIEW).join(', ');
    return names.length > NAMES_PREVIEW ? `${shown} +${names.length - NAMES_PREVIEW} more` : shown;
  });

  constructor() {
    effect(() => this.toasts.bottomInset.set(this.showCloseout() ? CLOSEOUT_DOCK_PX : 0));
    inject(DestroyRef).onDestroy(() => this.toasts.bottomInset.set(0));
  }

  /** "Week 4 · Mon 23 – Fri 27 Nov (Current)"; upcoming weeks are listed but disabled. */
  protected weekLabel(w: CohortWeek): string {
    const range = `${formatDate(w.start, 'EEE d', this.locale)} – ${formatDate(w.end, 'EEE d MMM', this.locale)}`;
    const suffix = w.start === this.f.currentWeek()?.start ? ' (Current)' : w.start > this.f.today() ? ' (Upcoming)' : '';
    return `Week ${w.number} · ${range}${suffix}`;
  }

  protected onWeek(event: Event): void {
    this.f.selectWeek((event.target as HTMLSelectElement).value as IsoDate);
  }

  protected onRate(id: string, e: RateEvent): void {
    this.f.rate(id, e.rating, e.customNote);
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
