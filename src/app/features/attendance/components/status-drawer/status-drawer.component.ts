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
  ATTENDANCE_REASONS,
  ATTENDANCE_STATUSES,
  NOTE_MAX_LENGTH,
  REASON_LABELS,
  STATUS_LABELS,
  type Apprentice,
  type AttendanceMark,
  type AttendancePattern,
  type AttendanceReason,
  type AttendanceStatus,
  type Id,
  type Specialization,
} from '../../../../domain';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { patternFlags } from '../../attendance-pattern.const';
import { STATUS_TONE } from '../../attendance-status.const';

/** What the drawer edits: one apprentice's mark on one day. `SweepEntry` satisfies it structurally. */
export interface MarkTarget {
  readonly id: Id;
  readonly name: string;
  readonly apprentice: Pick<Apprentice, 'avatarUrl'>;
  readonly specialization: Pick<Specialization, 'name'> | undefined;
  readonly coachName: string | null;
  readonly mark: AttendanceMark | null;
  /** Set when editing a past day (shown in the header; reset becomes "Clear record"). */
  readonly dateLabel?: string;
  /** Recurring absence / lateness as of that day — surfaced as a short notice. */
  readonly pattern?: AttendancePattern;
}

/**
 * Explicit status editor: P·L·A·E pills, 1-tap reason chips, optional note.
 * Native `<dialog>` — bottom sheet on phones, centered card on desktop (focus trap + Esc for free).
 * `P` saves instantly; a reason chip saves instantly unless the note is open; `E` cannot save without a reason.
 */
@Component({
  selector: 'ap-status-drawer',
  imports: [AvatarComponent, IconComponent],
  templateUrl: './status-drawer.component.html',
  styleUrl: './status-drawer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusDrawerComponent {
  /** Open while non-null. */
  readonly entry = input<MarkTarget | null>(null);
  /** Pre-selected status when opened from a shortcut (e.g. `E` key). */
  readonly preset = input<AttendanceStatus | null>(null);
  readonly save = output<AttendanceMark>();
  readonly cleared = output<void>();
  readonly closed = output<void>();

  protected readonly statuses = ATTENDANCE_STATUSES;
  protected readonly reasons = ATTENDANCE_REASONS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly reasonLabels = REASON_LABELS;
  protected readonly tones = STATUS_TONE;
  protected readonly noteMax = NOTE_MAX_LENGTH;

  // Form state re-seeds only when a *different* apprentice opens — live stream updates don't clobber edits.
  private readonly openedId = computed(() => {
    const e = this.entry();
    return e ? `${e.id}|${e.dateLabel ?? ''}` : null;
  });
  protected readonly status = linkedSignal<string | null, AttendanceStatus | null>({
    source: this.openedId,
    computation: () => untracked(this.preset) ?? untracked(this.entry)?.mark?.status ?? null,
  });
  protected readonly reason = linkedSignal<string | null, AttendanceReason | null>({
    source: this.openedId,
    computation: () => untracked(this.entry)?.mark?.reason ?? null,
  });
  protected readonly note = linkedSignal<string | null, string>({
    source: this.openedId,
    computation: () => untracked(this.entry)?.mark?.note ?? '',
  });
  protected readonly noteOpen = linkedSignal<string | null, boolean>({
    source: this.openedId,
    computation: () => !!untracked(this.entry)?.mark?.note,
  });

  protected readonly flags = computed(() => patternFlags(this.entry()?.pattern));

  protected readonly reasonRequired = computed(() => this.status() === 'E');
  protected readonly showReasons = computed(() => {
    const s = this.status();
    return s !== null && s !== 'P';
  });
  protected readonly canSave = computed(
    () =>
      this.status() !== null &&
      !(this.reasonRequired() && this.reason() === null) &&
      this.note().trim().length <= NOTE_MAX_LENGTH,
  );

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      const open = this.openedId() !== null;
      if (open && !el.open) el.showModal();
      else if (!open && el.open) el.close();
    });
  }

  protected pickStatus(s: AttendanceStatus): void {
    this.status.set(s);
    if (s === 'P' && !this.noteOpen()) this.submit();
  }

  protected pickReason(r: AttendanceReason): void {
    const next = this.reason() === r ? null : r;
    this.reason.set(next);
    if (next && !this.noteOpen() && this.showReasons()) this.submit();
  }

  protected onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected submit(): void {
    const status = this.status();
    if (!status || !this.canSave()) return;
    this.save.emit({
      status,
      reason: status === 'P' ? null : this.reason(),
      note: this.note().trim() || null,
    });
    this.close();
  }

  protected resetToWaiting(): void {
    this.cleared.emit();
    this.close();
  }

  /** Clicks on the dialog element itself (not its content) land on the backdrop. Esc is handled natively. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }
}
