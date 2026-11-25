import { ChangeDetectionStrategy, Component, type ElementRef, input, model, output, viewChild } from '@angular/core';
import type { Specialization } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import type { CoachFilter, SpecFilter } from '../../data-access/roster-scope.util';

export interface SpecializationChip {
  readonly specialization: Specialization;
  /** Count shown on the chip (e.g. remaining, needs follow-up); null hides it. */
  readonly badge: number | null;
  /** Shows a check instead of a badge (e.g. everyone swept). */
  readonly done: boolean;
  /** Screen-reader suffix, e.g. "4 not here yet". */
  readonly hint: string;
}

const COACH_OPTIONS: readonly { value: CoachFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'MINE', label: 'Mine' },
  { value: 'UNASSIGNED', label: 'Unassigned' },
];

/** Search + coach scope + specialization chips. Search text is debounced downstream (facade). */
@Component({
  selector: 'ap-sweep-filter-bar',
  imports: [IconComponent],
  templateUrl: './sweep-filter-bar.component.html',
  styleUrl: './sweep-filter-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SweepFilterBarComponent {
  readonly chips = input.required<readonly SpecializationChip[]>();
  readonly search = input('');
  readonly spec = model.required<SpecFilter>();
  readonly coach = model.required<CoachFilter>();
  readonly searchChange = output<string>();

  protected readonly coachOptions = COACH_OPTIONS;
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

  protected onCoachSelect(event: Event): void {
    this.coach.set((event.target as HTMLSelectElement).value as CoachFilter);
  }

  protected clearSearch(): void {
    this.searchChange.emit('');
    this.searchInput().nativeElement.focus();
  }
}
