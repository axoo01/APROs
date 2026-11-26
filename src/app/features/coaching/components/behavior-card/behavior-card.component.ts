import { DatePipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import {
  BEHAVIOR_DEFINITIONS,
  BEHAVIOR_LABELS,
  BEHAVIOR_RATINGS,
  NOTE_MAX_LENGTH,
  isStandardBehaviorNote,
  type BehaviorRating,
} from '../../../../domain';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { RATING_TONE } from '../../../../shared/utils/behavior-rating.const';
import type { BehaviorEntry } from '../../data-access/behavior.facade';

export interface RateEvent {
  readonly rating: BehaviorRating;
  /** Unsaved custom note typed before picking a rating (kept instead of the standard definition). */
  readonly customNote: string | null;
}

/**
 * One apprentice's weekly behavior. Unrated → full card: context digest (attendance, EOD, 4-week trajectory,
 * notes), six rating pills and an inline note bar the rating pre-fills. Rated → compact one-line summary;
 * the row / Edit re-opens the full card, Done (or saving the note) collapses it again.
 */
@Component({
  selector: 'ap-behavior-card',
  imports: [DatePipe, PercentPipe, AvatarComponent, IconComponent],
  templateUrl: './behavior-card.component.html',
  styleUrl: './behavior-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BehaviorCardComponent {
  readonly entry = input.required<BehaviorEntry>();
  readonly disabled = input(false);
  readonly rate = output<RateEvent>();
  readonly saveNote = output<string>();
  readonly clear = output<void>();

  protected readonly ratings = BEHAVIOR_RATINGS;
  protected readonly labels = BEHAVIOR_LABELS;
  protected readonly tones = RATING_TONE;
  protected readonly noteMax = NOTE_MAX_LENGTH;
  protected readonly notesOpen = signal(false);
  /** Explicitly opened for editing (or just rated from the full card, so the coach can tweak the note). */
  protected readonly editing = signal(false);
  protected readonly expanded = computed(() => !this.entry().rating || this.editing());

  protected readonly specColor = computed(() => {
    const tag = this.entry().specialization?.colorTag;
    return tag ? colorTagVar(tag) : 'var(--ap-line-strong)';
  });

  /** Draft re-seeds whenever the saved note changes (e.g. a new rating pre-fills its definition). */
  protected readonly draft = linkedSignal(() => this.entry().note ?? '');
  protected readonly dirty = computed(() => this.draft().trim() !== (this.entry().note ?? ''));
  protected readonly customDraft = computed(() => (this.dirty() && !isStandardBehaviorNote(this.draft()) ? this.draft().trim() : null));
  /** Offer "Reset text" when the note differs from the current rating's definition. */
  protected readonly canReset = computed(() => {
    const r = this.entry().rating;
    return !!r && this.draft().trim() !== BEHAVIOR_DEFINITIONS[r];
  });

  protected pick(rating: BehaviorRating): void {
    this.editing.set(true);
    this.rate.emit({ rating, customNote: this.customDraft() });
  }

  /** Saves a pending note edit, then collapses to the compact row. */
  protected done(): void {
    this.commit();
    this.editing.set(false);
  }

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  /** Enter saves; Shift+Enter keeps the newline. */
  protected onEnter(event: Event): void {
    if ((event as KeyboardEvent).shiftKey) return;
    event.preventDefault();
    this.commit();
  }

  protected commit(): void {
    if (!this.dirty() || !this.entry().rating || this.draft().length > NOTE_MAX_LENGTH) return;
    this.saveNote.emit(this.draft());
    this.editing.set(false);
  }

  protected revert(): void {
    this.draft.set(this.entry().note ?? '');
  }

  protected resetText(): void {
    const r = this.entry().rating;
    if (r) this.draft.set(BEHAVIOR_DEFINITIONS[r]);
  }
}
