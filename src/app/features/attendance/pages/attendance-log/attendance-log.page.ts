import { formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, LOCALE_ID, computed, inject, signal, viewChild } from '@angular/core';
import type { AttendanceMark, IsoDate } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { DateScopeToolbarComponent } from '../../../../shared/components/date-scope-toolbar/date-scope-toolbar.component';
import { StatusCardListComponent } from '../../../../shared/components/status-card-list/status-card-list.component';
import {
  StatusMatrixComponent,
  type MatrixSelection,
} from '../../../../shared/components/status-matrix/status-matrix.component';
import { downloadFile } from '../../../../shared/utils/download.util';
import { DayListComponent } from '../../components/day-list/day-list.component';
import { KpiStripComponent } from '../../components/kpi-strip/kpi-strip.component';
import { StatusDrawerComponent } from '../../components/status-drawer/status-drawer.component';
import { RosterFilterBarComponent } from '../../../../shared/components/roster-filter-bar/roster-filter-bar.component';
import { AttendanceLogFacade } from '../../data-access/attendance-log.facade';

/** Past days & trends: KPIs for the chosen window, matrix (or single-day list), retro edits, CSV export. */
@Component({
  selector: 'ap-attendance-log-page',
  imports: [
    IconComponent,
    PageHeaderComponent,
    DateScopeToolbarComponent,
    DayListComponent,
    KpiStripComponent,
    StatusCardListComponent,
    StatusDrawerComponent,
    StatusMatrixComponent,
    RosterFilterBarComponent,
  ],
  providers: [AttendanceLogFacade],
  templateUrl: './attendance-log.page.html',
  styleUrl: './attendance-log.page.css',
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendanceLogPage {
  protected readonly f = inject(AttendanceLogFacade);
  private readonly toasts = inject(ToastService);
  private readonly filterBar = viewChild.required(RosterFilterBarComponent);

  protected readonly editing = signal<MatrixSelection | null>(null);
  protected readonly editTarget = computed(() => {
    const e = this.editing();
    return e ? this.f.target(e.rowId, e.date) : null;
  });

  private readonly locale = inject(LOCALE_ID);

  /** Same shape as Today's Sweep: "<date or range> · <cohort>". */
  protected readonly subtitle = computed(() => {
    const days = this.f.days();
    const first = days[0];
    const last = days.at(-1);
    const cohort = this.f.cohort()?.displayName ?? '';
    const fmt = (d: string, pattern: string) => formatDate(d, pattern, this.locale);
    const range = !first || !last
      ? 'No working days in range'
      : first === last
        ? fmt(first, 'EEEE, d MMMM')
        : `${fmt(first, 'EEE, d MMM')} – ${fmt(last, 'EEE, d MMM')} · ${days.length} working days`;
    return cohort ? `${range} · ${cohort}` : range;
  });

  protected edit(selection: MatrixSelection): void {
    this.editing.set(selection);
  }

  protected onSave(mark: AttendanceMark): void {
    this.apply(mark);
  }

  protected onClear(): void {
    this.apply(null);
  }

  protected onDay(day: IsoDate): void {
    this.f.setDay(day);
  }

  protected export(): void {
    const file = this.f.exportCsv();
    if (!file) return;
    downloadFile(file.filename, file.content);
    this.toasts.show({ tone: 'success', message: `Exported ${file.rows} rows to ${file.filename}` });
  }

  protected onGlobalKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
    if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      this.filterBar().focusSearch();
    }
  }

  private apply(mark: AttendanceMark | null): void {
    const e = this.editing();
    if (e) this.f.setMark(e.rowId, e.date, mark);
  }
}
