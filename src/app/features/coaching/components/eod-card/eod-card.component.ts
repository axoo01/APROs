import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { EOD_STATUS_LABELS, EOD_TAG_LABELS, STATUS_LABELS, type EodStatus } from '../../../../domain';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { LongPressDirective } from '../../../../shared/directives/long-press.directive';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import type { EodEntry } from '../../data-access/eod.facade';
import { EOD_SHORT, EOD_TONE, behindFlag } from '../../eod-status.const';

const KEYS: Readonly<Record<string, EodStatus>> = { o: 'ON_PACE', s: 'NEEDS_SUPPORT', b: 'BLOCKED' };

export interface EodCardTap {
  readonly byKeyboard: boolean;
}

/**
 * One apprentice in the EOD sweep. Presentational: tap → `tapped`, long-press / ⋯ / `D` → `details`,
 * note icon / `N` → `note`, `O` `S` `B` keys → `quickStatus`. `muted` = absent/excused or not checked in.
 */
@Component({
  selector: 'ap-eod-card',
  imports: [AvatarComponent, IconComponent, LongPressDirective],
  templateUrl: './eod-card.component.html',
  styleUrl: './eod-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EodCardComponent {
  readonly entry = input.required<EodEntry>();
  readonly muted = input(false);
  readonly disabled = input(false);
  readonly tapped = output<EodCardTap>();
  readonly details = output<void>();
  readonly note = output<void>();
  readonly quickStatus = output<EodStatus>();

  protected readonly short = EOD_SHORT;

  protected readonly stripe = computed(() => {
    const tag = this.entry().specialization?.colorTag;
    return tag ? colorTagVar(tag) : 'var(--ap-line-strong)';
  });

  protected readonly tone = computed(() => {
    const s = this.entry().mark?.status;
    return s ? EOD_TONE[s] : null;
  });

  protected readonly flag = computed(() => behindFlag(this.entry().behindStreak));

  protected readonly subtitle = computed(() => {
    const { mark, coachName, attendance, lane } = this.entry();
    if (mark?.tag || mark?.note) {
      return [mark.tag ? EOD_TAG_LABELS[mark.tag] : null, mark.note].filter(Boolean).join(' — ');
    }
    if (lane === 'AWAY' && attendance) return `${STATUS_LABELS[attendance]} today`;
    if (lane === 'NOT_CHECKED_IN') return 'Not checked in yet';
    return coachName ?? 'Unassigned';
  });

  protected readonly ariaLabel = computed(() => {
    const { name, mark } = this.entry();
    const state = mark ? EOD_STATUS_LABELS[mark.status] : 'Not logged';
    const flag = this.flag();
    const hint = mark ? 'Enter for details' : 'Enter marks on pace, S needs support, B blocked, N note';
    return [`${name}, ${state}.`, flag ? `${flag.description}.` : '', `${hint}.`].filter(Boolean).join(' ');
  });

  protected onClick(event: MouseEvent): void {
    this.tapped.emit({ byKeyboard: event.detail === 0 });
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'd' || key === 'n') {
      event.preventDefault();
      if (key === 'd') this.details.emit();
      else this.note.emit();
      return;
    }
    const status = KEYS[key];
    if (status) {
      event.preventDefault();
      this.quickStatus.emit(status);
    }
  }
}
