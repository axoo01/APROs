import { DatePipe, PercentPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  effect,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';
import { BEHAVIOR_LABELS, HEALTH_TIER_LABELS, onPaceRate, sprintBand } from '../../../domain';
import { AvatarComponent } from '../avatar/avatar.component';
import { IconComponent, type IconName } from '../icon/icon.component';
import { colorTagVar } from '../../utils/color-tag.util';
import { RATING_TONE } from '../../utils/behavior-rating.const';
import type { Passport, TimelineItem, TimelineKind } from '../../../core/state/cohort-health.store';
import { SPRINT_TONE, TIER_TONE } from '../../utils/health-tier.const';

type TimelineFilter = TimelineKind | 'ALL';

const PAGE = 30;

const KIND_META: Readonly<Record<TimelineKind, { label: string; icon: IconName }>> = {
  ATTENDANCE: { label: 'Attendance', icon: 'calendar-check' },
  EOD: { label: 'EOD', icon: 'gauge' },
  BEHAVIOR: { label: 'Behavior', icon: 'user-check' },
  SPRINT: { label: 'Sprints', icon: 'layers' },
};

const DOT: Readonly<Record<TimelineItem['tone'], string>> = {
  good: 'bg-success',
  warn: 'bg-status-l',
  bad: 'bg-danger',
  neutral: 'bg-fg-subtle',
};

/**
 * 360° Apprentice Passport: right-hand slide-over (`<dialog class="slide-over">`) with health header,
 * 4-pillar scorecard, behavior trajectory, sprint marks, unified timeline and "Copy 1-on-1 Brief".
 */
@Component({
  selector: 'ap-apprentice-passport',
  imports: [DatePipe, PercentPipe, AvatarComponent, IconComponent],
  templateUrl: './apprentice-passport.component.html',
  styleUrl: './apprentice-passport.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprenticePassportComponent {
  /** Open while non-null. */
  readonly passport = input<Passport | null>(null);
  readonly closed = output<void>();
  readonly copyBrief = output<void>();

  protected readonly tierLabels = HEALTH_TIER_LABELS;
  protected readonly tierTone = TIER_TONE;
  protected readonly ratingTone = RATING_TONE;
  protected readonly ratingLabels = BEHAVIOR_LABELS;
  protected readonly kindMeta = KIND_META;
  protected readonly dot = DOT;
  protected readonly tag = colorTagVar;
  protected readonly onPace = onPaceRate;
  protected readonly sprintTone = (score: number) => SPRINT_TONE[sprintBand(score)];
  protected readonly filters: readonly TimelineFilter[] = ['ALL', 'ATTENDANCE', 'EOD', 'BEHAVIOR', 'SPRINT'];

  private readonly openedId = computed(() => this.passport()?.entry.id ?? null);
  protected readonly filter = linkedSignal<string | null, TimelineFilter>({ source: this.openedId, computation: () => 'ALL' });
  protected readonly limit = linkedSignal<string | null, number>({ source: this.openedId, computation: () => PAGE });

  protected readonly counts = computed(() => {
    const c: Record<TimelineFilter, number> = { ALL: 0, ATTENDANCE: 0, EOD: 0, BEHAVIOR: 0, SPRINT: 0 };
    for (const t of this.passport()?.timeline ?? []) {
      c[t.kind] += 1;
      c.ALL += 1;
    }
    return c;
  });
  private readonly filtered = computed(() => {
    const f = this.filter();
    const items = this.passport()?.timeline ?? [];
    return f === 'ALL' ? items : items.filter((t) => t.kind === f);
  });
  protected readonly visible = computed(() => this.filtered().slice(0, this.limit()));
  protected readonly remaining = computed(() => Math.max(0, this.filtered().length - this.limit()));
  protected readonly hasSprints = computed(() => this.passport()?.entry.sprints.some((m) => m !== null) ?? false);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      const open = this.openedId() !== null;
      if (open && !el.open) el.showModal();
      else if (!open && el.open) el.close();
    });
  }

  protected filterLabel(f: TimelineFilter): string {
    return f === 'ALL' ? 'All' : KIND_META[f].label;
  }

  protected showMore(): void {
    this.limit.update((n) => n + PAGE);
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }
}
