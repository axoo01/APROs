import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BUCKET_LABELS, type AttendanceBucket } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { AttendanceTodayFacade } from '../../data-access/attendance-today.facade';

const BUCKET_STYLE: Record<AttendanceBucket, string> = {
  NOT_HERE_YET: 'bg-surface-2 text-fg',
  PRESENT: 'bg-status-p-soft text-status-p',
  ABSENT_EXCUSED: 'bg-status-a-soft text-status-a',
};

/**
 * Milestone 1 · Step 1 placeholder: live bucket counts wired through the real data layer.
 * The full "Sweep & Reveal" interaction ships in Step 2.
 */
@Component({
  selector: 'ap-attendance-page',
  imports: [DatePipe, IconComponent, PageHeaderComponent],
  providers: [AttendanceTodayFacade],
  templateUrl: './attendance.page.html',
  styleUrl: './attendance.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendancePage {
  protected readonly facade = inject(AttendanceTodayFacade);
  protected readonly tagColor = colorTagVar;

  protected readonly bucketList = computed(() => {
    const counts = this.facade.buckets();
    return (Object.keys(BUCKET_LABELS) as AttendanceBucket[]).map((key) => ({
      key,
      label: BUCKET_LABELS[key],
      count: counts[key],
      style: BUCKET_STYLE[key],
    }));
  });
}
