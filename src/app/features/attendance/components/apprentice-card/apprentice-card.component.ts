import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { REASON_LABELS, STATUS_LABELS, type AttendanceStatus } from '../../../../domain';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { LongPressDirective } from '../../../../shared/directives/long-press.directive';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { patternFlags } from '../../attendance-pattern.const';
import { STATUS_KEYS, STATUS_TONE } from '../../attendance-status.const';
import type { SweepEntry } from '../../data-access/attendance.facade';

export interface CardTap {
  /** Activated with Enter/Space rather than a pointer (the page then advances focus). */
  readonly byKeyboard: boolean;
}

/**
 * One apprentice in the sweep. Presentational: tap → `tapped`, long-press / ⋯ / `D` → `details`,
 * `P` `L` `A` `E` keys → `quickStatus`. The parent decides what each means.
 */
@Component({
  selector: 'ap-apprentice-card',
  imports: [AvatarComponent, IconComponent, LongPressDirective],
  templateUrl: './apprentice-card.component.html',
  styleUrl: './apprentice-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprenticeCardComponent {
  readonly entry = input.required<SweepEntry>();
  readonly disabled = input(false);
  readonly tapped = output<CardTap>();
  readonly details = output<void>();
  readonly quickStatus = output<AttendanceStatus>();

  protected readonly stripe = computed(() => {
    const tag = this.entry().specialization?.colorTag;
    return tag ? colorTagVar(tag) : 'var(--ap-line-strong)';
  });

  protected readonly tone = computed(() => {
    const status = this.entry().mark?.status;
    return status ? STATUS_TONE[status] : null;
  });

  protected readonly subtitle = computed(() => {
    const { mark, coachName } = this.entry();
    if (mark?.reason) return `${STATUS_LABELS[mark.status]} · ${REASON_LABELS[mark.reason]}`;
    if (mark?.note) return mark.note;
    return coachName ?? 'Unassigned';
  });

  /** Recurring-pattern pills (shared wording with the status drawer). */
  protected readonly flags = computed(() => patternFlags(this.entry().pattern));

  protected readonly ariaLabel = computed(() => {
    const { name, mark } = this.entry();
    const state = mark ? STATUS_LABELS[mark.status] : 'Not here yet';
    const patterns = this.flags().map((f) => f.description);
    const hint = mark ? 'Enter for details' : 'Enter marks present, L late, A absent, E excused';
    return [`${name}, ${state}.`, ...patterns.map((d) => `${d}.`), `${hint}.`].join(' ');
  });

  protected onClick(event: MouseEvent): void {
    this.tapped.emit({ byKeyboard: event.detail === 0 });
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'd') {
      event.preventDefault();
      this.details.emit();
      return;
    }
    const status = STATUS_KEYS[key];
    if (status) {
      event.preventDefault();
      this.quickStatus.emit(status);
    }
  }
}
