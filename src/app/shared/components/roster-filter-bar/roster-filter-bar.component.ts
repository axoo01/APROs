import { ChangeDetectionStrategy, Component, type ElementRef, input, model, output, viewChild } from '@angular/core';
import type { Specialization } from '../../../domain';
import { IconComponent } from '../icon/icon.component';
import { colorTagVar } from '../../utils/color-tag.util';
import type { CoachFilter, CoachOption, SpecFilter } from '../../utils/roster-scope.util';

export interface SpecializationChip {
  readonly specialization: Specialization;
  /** Count shown on the chip (e.g. remaining, needs follow-up); null hides it. */
  readonly badge: number | null;
  /** Shows a check instead of a badge (e.g. everyone swept). */
  readonly done: boolean;
  /** Screen-reader suffix, e.g. "4 not here yet". */
  readonly hint: string;
}

/**
 * Roster filters shared by every roster screen: search, coach scope (All · Mine pills + any-coach dropdown)
 * and specialization chips. Search text is debounced downstream (facade).
 */
@Component({
  selector: 'ap-roster-filter-bar',
  imports: [IconComponent],
  templateUrl: './roster-filter-bar.component.html',
  styleUrl: './roster-filter-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterFilterBarComponent {
  readonly chips = input.required<readonly SpecializationChip[]>();
  readonly coaches = input.required<readonly CoachOption[]>();
  /** Show the "Mine" pill (the signed-in user coaches apprentices). */
  readonly showMine = input(true);
  readonly search = input('');
  readonly spec = model.required<SpecFilter>();
  readonly coach = model.required<CoachFilter>();
  readonly searchChange = output<string>();

  protected readonly tagColor = colorTagVar;
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');

  focusSearch(): void {
    const el = this.searchInput().nativeElement;
    el.focus();
    el.select();
  }

  protected onSearch(event: Event): void {
    this.searchChange.emit((event.target as HTMLInputElement).value);
  }

  /** Dropdown value: a specific coach id, or '' for "All coaches" (also shown while "Mine" is active). */
  protected selectedCoach(): string {
    const c = this.coach();
    return c === 'ALL' || c === 'MINE' ? '' : c;
  }

  protected onCoachSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.coach.set(value || 'ALL');
  }

  protected clearSearch(): void {
    this.searchChange.emit('');
    this.searchInput().nativeElement.focus();
  }
}
