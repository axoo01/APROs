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
import { type AttendanceStatus, type Id } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { copyText } from '../../../../shared/utils/clipboard.util';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { ApprenticeCardComponent, type CardTap } from '../../components/apprentice-card/apprentice-card.component';
import { BucketTabsComponent } from '../../components/bucket-tabs/bucket-tabs.component';
import { CloseoutBarComponent } from '../../components/closeout-bar/closeout-bar.component';
import { CloseoutSheetComponent } from '../../components/closeout-sheet/closeout-sheet.component';
import { DayPulseComponent } from '../../components/day-pulse/day-pulse.component';
import { DaySummaryComponent } from '../../components/day-summary/day-summary.component';
import { StatusDrawerComponent } from '../../components/status-drawer/status-drawer.component';
import { SweepFilterBarComponent } from '../../components/sweep-filter-bar/sweep-filter-bar.component';
import { AttendanceFacade, type SweepEntry } from '../../data-access/attendance.facade';

/** Height the docked closeout bar occupies, so toasts float above it. */
const CLOSEOUT_DOCK_PX = 76;

const EMPTY_COPY = {
  PRESENT: { title: 'No one marked present yet', body: 'Tap a card in Not Here Yet to mark it Present.' },
  ABSENT_EXCUSED: { title: 'No absences or excuses', body: 'Use ⋯ on a card, or close out the sweep, to mark Absent / Excused.' },
  NOT_HERE_YET: { title: 'No matches', body: 'Try another name, specialization or coach filter.' },
} as const;

/**
 * Live Sweep & Reveal. Tap = Present, tap again within the reveal window = Late, long-press / ⋯ = details.
 * All state and commands live in {@link AttendanceFacade}; this page only routes UI events.
 */
@Component({
  selector: 'ap-attendance-page',
  imports: [
    DatePipe,
    IconComponent,
    PageHeaderComponent,
    ApprenticeCardComponent,
    BucketTabsComponent,
    CloseoutBarComponent,
    CloseoutSheetComponent,
    DayPulseComponent,
    DaySummaryComponent,
    StatusDrawerComponent,
    SweepFilterBarComponent,
  ],
  providers: [AttendanceFacade],
  templateUrl: './attendance.page.html',
  styleUrl: './attendance.page.css',
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendancePage {
  protected readonly f = inject(AttendanceFacade);
  private readonly toasts = inject(ToastService);

  protected readonly tagColor = colorTagVar;
  protected readonly panelId = 'sweep-panel';
  protected readonly emptyCopy = EMPTY_COPY;

  protected readonly details = signal<{ id: Id; preset: AttendanceStatus | null } | null>(null);
  protected readonly detailsEntry = computed(() => {
    const d = this.details();
    return d ? (this.f.entryById().get(d.id) ?? null) : null;
  });
  protected readonly closeoutOpen = signal(false);

  protected readonly showCloseout = computed(() => this.f.canRecord() && this.f.remaining().length > 0);
  protected readonly showSummary = computed(
    () => this.f.activeBucket() === 'NOT_HERE_YET' && this.f.isSwept() && this.f.visibleCount() === 0,
  );

  protected readonly liveSummary = computed(() => {
    const c = this.f.counts();
    return `${c.NOT_HERE_YET} not here yet, ${c.PRESENT} present, ${c.ABSENT_EXCUSED} absent or excused.`;
  });

  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private readonly filterBar = viewChild.required(SweepFilterBarComponent);

  constructor() {
    effect(() => this.toasts.bottomInset.set(this.showCloseout() ? CLOSEOUT_DOCK_PX : 0));
    inject(DestroyRef).onDestroy(() => this.toasts.bottomInset.set(0));
  }

  // ── Card events ────────────────────────────────────────────────────────────
  protected onTap(entry: SweepEntry, tap: CardTap): void {
    if (entry.mark && !entry.revealing) {
      // Already accounted for (Present / Absent tabs): a tap means "edit", never a silent re-mark.
      this.openDetails(entry.id);
      return;
    }
    if (tap.byKeyboard && !entry.mark) this.focusSibling(1);
    this.f.tap(entry.id);
  }

  protected onQuickStatus(entry: SweepEntry, status: AttendanceStatus): void {
    if (status === 'E' && !entry.mark?.reason) {
      this.openDetails(entry.id, 'E');
      return;
    }
    if (!entry.mark) this.focusSibling(1);
    this.f.setMark(entry.id, {
      status,
      reason: status === 'P' ? null : (entry.mark?.reason ?? null),
      note: entry.mark?.note ?? null,
    });
  }

  protected openDetails(id: Id, preset: AttendanceStatus | null = null): void {
    this.details.set({ id, preset });
  }

  protected onDetailsSave(next: Parameters<AttendanceFacade['setMark']>[1]): void {
    const d = this.details();
    if (d) this.f.setMark(d.id, next);
  }

  protected onDetailsReset(): void {
    const d = this.details();
    if (d) this.f.resetMark(d.id);
  }

  /** Swept cards (still flagged as revealing when removed) slide out; everything else (tab/filter switches) leaves instantly. */
  protected onCardLeave(event: AnimationCallbackEvent): void {
    const el = event.target as HTMLElement;
    if (el.dataset['revealing'] !== 'true') {
      event.animationComplete();
      return;
    }
    el.addEventListener('animationend', () => event.animationComplete(), { once: true });
    el.classList.add('sweep-leave');
  }

  protected async copyReport(): Promise<void> {
    const report = this.f.dayReport();
    if (!report) return;
    const ok = await copyText(report);
    this.toasts.show(
      ok
        ? { tone: 'success', message: 'Absent / Late summary copied — paste it into Slack or Teams.' }
        : { tone: 'danger', message: "Couldn't access the clipboard. Try again from a secure (https) page." },
    );
  }

  // ── Keyboard ───────────────────────────────────────────────────────────────
  protected onGlobalKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = !!target?.closest('input, textarea, select, [contenteditable="true"]');
    if (typing || document.querySelector('dialog[open]')) return;

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
    if (delta === undefined && event.key !== 'Home' && event.key !== 'End') return;
    if (!(event.target as HTMLElement).matches('[data-sweep-card]')) return;
    event.preventDefault();
    const cards = this.cards();
    if (event.key === 'Home') cards[0]?.focus();
    else if (event.key === 'End') cards[cards.length - 1]?.focus();
    else this.focusSibling(delta ?? 0);
  }

  private cards(): HTMLElement[] {
    const root = this.list()?.nativeElement;
    return root ? [...root.querySelectorAll<HTMLElement>('[data-sweep-card]:not(:disabled)')] : [];
  }

  /** Roving focus relative to the focused card; skips cards that are mid-reveal (about to leave). */
  private focusSibling(delta: number): void {
    const cards = this.cards().filter((c) => c === document.activeElement || !c.closest('[data-revealing="true"]'));
    const i = cards.indexOf(document.activeElement as HTMLElement);
    cards[i + delta]?.focus();
  }
}
