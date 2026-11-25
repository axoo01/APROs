import { DatePipe } from '@angular/common';
import {
  type AnimationCallbackEvent,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { EodMark, EodStatus, Id } from '../../../../domain';
import { CloseoutBarComponent } from '../../../../shared/components/closeout-bar/closeout-bar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { RosterFilterBarComponent } from '../../../../shared/components/roster-filter-bar/roster-filter-bar.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { EodCardComponent, type EodCardTap } from '../../components/eod-card/eod-card.component';
import { EodDrawerComponent } from '../../components/eod-drawer/eod-drawer.component';
import { EodLaneSectionComponent } from '../../components/eod-lane-section/eod-lane-section.component';
import { EodStatusTabsComponent } from '../../components/eod-status-tabs/eod-status-tabs.component';
import { EodFacade, type EodEntry } from '../../data-access/eod.facade';

const CLOSEOUT_DOCK_PX = 76;

const EMPTY_COPY = {
  NOT_LOGGED: { title: 'No matches', body: 'Try another name, specialization or coach.' },
  ON_PACE: { title: 'No one marked On Pace yet', body: 'Tap a card in Not Logged to mark it On Pace.' },
  NEEDS_SUPPORT: { title: 'Nobody needs support', body: 'Use ⋯ or long-press a card to flag someone who is behind.' },
  BLOCKED: { title: 'Nobody is blocked', body: 'Use ⋯ or long-press a card to flag a blocker.' },
} as const;

/**
 * Today's EOD pacing (reverse sweep). Tap = On Pace, tap again / long-press / ⋯ = drawer, note icon = quick note.
 * Present apprentices form the queue; absent/excused and not-checked-in sit in muted collapsed sections.
 */
@Component({
  selector: 'ap-eod-page',
  imports: [
    DatePipe,
    RouterLink,
    CloseoutBarComponent,
    IconComponent,
    PageHeaderComponent,
    RosterFilterBarComponent,
    EodCardComponent,
    EodDrawerComponent,
    EodLaneSectionComponent,
    EodStatusTabsComponent,
  ],
  providers: [EodFacade],
  templateUrl: './eod.page.html',
  styleUrl: './eod.page.css',
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EodPage {
  protected readonly f = inject(EodFacade);
  private readonly toasts = inject(ToastService);

  protected readonly panelId = 'eod-panel';
  protected readonly tagColor = colorTagVar;
  protected readonly emptyCopy = EMPTY_COPY;

  protected readonly editing = signal<{ id: Id; preset: EodStatus | null; focusNote: boolean } | null>(null);
  protected readonly editTarget = computed(() => {
    const e = this.editing();
    return e ? (this.f.entryById().get(e.id) ?? null) : null;
  });

  protected readonly showCloseout = computed(() => this.f.canRecord() && this.f.remaining().length > 0);
  protected readonly liveSummary = computed(() => {
    const c = this.f.counts();
    return `${c.NOT_LOGGED} not logged, ${c.ON_PACE} on pace, ${c.NEEDS_SUPPORT} need support, ${c.BLOCKED} blocked.`;
  });

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private readonly filterBar = viewChild.required(RosterFilterBarComponent);

  constructor() {
    effect(() => this.toasts.bottomInset.set(this.showCloseout() ? CLOSEOUT_DOCK_PX : 0));
    inject(DestroyRef).onDestroy(() => this.toasts.bottomInset.set(0));
  }

  protected onTap(entry: EodEntry, tap: EodCardTap): void {
    if (tap.byKeyboard && !entry.mark) this.focusNext();
    if (this.f.tap(entry.id) === 'details') this.open(entry.id);
  }

  protected onQuickStatus(entry: EodEntry, status: EodStatus): void {
    if (status === 'ON_PACE') {
      if (!entry.mark) this.focusNext();
      this.f.setMark(entry.id, { status, tag: null, note: entry.mark?.note ?? null });
    } else {
      // Behind statuses usually deserve a blocker tag — open the drawer pre-set.
      this.open(entry.id, status);
    }
  }

  protected open(id: Id, preset: EodStatus | null = null, focusNote = false): void {
    this.editing.set({ id, preset, focusNote });
  }

  protected onSave(mark: EodMark): void {
    const e = this.editing();
    if (e) this.f.setMark(e.id, mark);
  }

  protected onClear(): void {
    const e = this.editing();
    if (e) this.f.resetMark(e.id);
  }

  /** Rated cards (still flagged revealing when removed) slide out; tab/filter switches leave instantly. */
  protected onCardLeave(event: AnimationCallbackEvent): void {
    const el = event.target as HTMLElement;
    if (el.dataset['revealing'] !== 'true') {
      event.animationComplete();
      return;
    }
    el.addEventListener('animationend', () => event.animationComplete(), { once: true });
    el.classList.add('sweep-leave');
  }

  protected onGlobalKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
    if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.filterBar().focusSearch();
    } else if (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey) && !event.shiftKey) {
      event.preventDefault();
      this.f.undoLast();
    }
  }

  protected onListKey(event: KeyboardEvent): void {
    const moves: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    const delta = moves[event.key];
    if (delta === undefined || !(event.target as HTMLElement).matches('[data-sweep-card]')) return;
    event.preventDefault();
    this.focusSibling(delta);
  }

  private focusNext(): void {
    this.focusSibling(1);
  }

  private focusSibling(delta: number): void {
    const root = this.list()?.nativeElement;
    if (!root) return;
    const cards = [...root.querySelectorAll<HTMLElement>('[data-sweep-card]:not(:disabled)')].filter(
      (c) => c === document.activeElement || !c.closest('[data-revealing="true"]'),
    );
    cards[cards.indexOf(document.activeElement as HTMLElement) + delta]?.focus();
  }
}
