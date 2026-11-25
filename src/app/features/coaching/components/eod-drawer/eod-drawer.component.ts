import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  effect,
  input,
  linkedSignal,
  output,
  untracked,
  viewChild,
} from '@angular/core';
import {
  EOD_PRESETS,
  EOD_PRESET_NOTES,
  EOD_STATUSES,
  EOD_STATUS_LABELS,
  EOD_TAG_LABELS,
  NOTE_MAX_LENGTH,
  STATUS_LABELS,
  type Apprentice,
  type AttendanceStatus,
  type EodMark,
  type EodPreset,
  type EodStatus,
  type EodTag,
  type Id,
  type Specialization,
} from '../../../../domain';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { EOD_TONE, behindFlag } from '../../eod-status.const';

/** What the drawer edits: one apprentice's EOD on one day. `EodEntry` satisfies it structurally. */
export interface EodTarget {
  readonly id: Id;
  readonly name: string;
  readonly apprentice: Pick<Apprentice, 'avatarUrl'>;
  readonly specialization: Pick<Specialization, 'name'> | undefined;
  readonly coachName: string | null;
  readonly mark: EodMark | null;
  readonly behindStreak: number;
  /** That day's attendance (shows an "absent today" notice for overrides). */
  readonly attendance: AttendanceStatus | null;
  /** Set when editing a past day; reset becomes "Clear record". */
  readonly dateLabel?: string;
}

/**
 * EOD editor: On Pace · Needs Support · Blocked, three presets per status that select a tag and pre-fill
 * an editable note (never overwriting text the coach typed — "Reset text" restores the preset), then Save.
 */
@Component({
  selector: 'ap-eod-drawer',
  imports: [AvatarComponent, IconComponent],
  templateUrl: './eod-drawer.component.html',
  styleUrl: './eod-drawer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EodDrawerComponent {
  /** Open while non-null. */
  readonly target = input<EodTarget | null>(null);
  /** Pre-selected status (e.g. from the `S` / `B` keys). */
  readonly preset = input<EodStatus | null>(null);
  /** Open with the note field expanded and focused (card note icon). */
  readonly focusNote = input(false);
  readonly save = output<EodMark>();
  readonly cleared = output<void>();
  readonly closed = output<void>();

  protected readonly statuses = EOD_STATUSES;
  protected readonly statusLabels = EOD_STATUS_LABELS;
  protected readonly tagLabels = EOD_TAG_LABELS;
  protected readonly tones = EOD_TONE;
  protected readonly noteMax = NOTE_MAX_LENGTH;

  // Re-seed only when a different apprentice/day opens, so live updates never clobber edits.
  private readonly openedKey = computed(() => {
    const t = this.target();
    return t ? `${t.id}|${t.dateLabel ?? ''}` : null;
  });
  protected readonly status = linkedSignal<string | null, EodStatus>({
    source: this.openedKey,
    computation: () => untracked(this.preset) ?? untracked(this.target)?.mark?.status ?? 'ON_PACE',
  });
  protected readonly tag = linkedSignal<string | null, EodTag | null>({
    source: this.openedKey,
    computation: () => untracked(this.target)?.mark?.tag ?? null,
  });
  protected readonly note = linkedSignal<string | null, string>({
    source: this.openedKey,
    computation: () => untracked(this.target)?.mark?.note ?? '',
  });
  protected readonly presets = computed(() => EOD_PRESETS[this.status()]);
  /** The preset sentence for the selected tag (if any) — target of "Reset text". */
  protected readonly presetNote = computed(() => this.presets().find((p) => p.tag === this.tag())?.note ?? null);
  /** Coach typed something other than a preset sentence → presets won't overwrite it. */
  protected readonly customText = computed(() => {
    const note = this.note().trim();
    return note.length > 0 && !EOD_PRESET_NOTES.has(note);
  });
  protected readonly flag = computed(() => behindFlag(this.target()?.behindStreak ?? 0));
  protected readonly awayNotice = computed(() => {
    const a = this.target()?.attendance;
    return a === 'A' || a === 'E' ? `Marked ${STATUS_LABELS[a]} — rating overrides the usual skip.` : null;
  });
  protected readonly canSave = computed(() => this.note().trim().length <= NOTE_MAX_LENGTH);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly noteField = viewChild<ElementRef<HTMLTextAreaElement>>('noteField');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      const open = this.openedKey() !== null;
      if (open && !el.open) {
        el.showModal();
        if (untracked(this.focusNote)) queueMicrotask(() => this.noteField()?.nativeElement.focus());
      } else if (!open && el.open) el.close();
    });
  }

  protected pickStatus(s: EodStatus): void {
    if (s === this.status()) return;
    this.status.set(s);
    // A preset from another status doesn't carry over (e.g. "Great Progress" on Blocked); its sentence goes too.
    const t = this.tag();
    if (t && !EOD_PRESETS[s].some((p) => p.tag === t)) {
      this.tag.set(null);
      if (!this.customText()) this.note.set('');
    }
  }

  protected pickPreset(p: EodPreset): void {
    if (this.tag() === p.tag) {
      this.tag.set(null);
      if (!this.customText()) this.note.set('');
      return;
    }
    this.tag.set(p.tag);
    if (!this.customText()) this.note.set(p.note);
  }

  protected resetText(): void {
    this.note.set(this.presetNote() ?? '');
    queueMicrotask(() => this.noteField()?.nativeElement.focus());
  }

  protected onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected submit(): void {
    if (!this.canSave()) return;
    this.save.emit({ status: this.status(), tag: this.tag(), note: this.note().trim() || null });
    this.close();
  }

  protected clear(): void {
    this.cleared.emit();
    this.close();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }
}
