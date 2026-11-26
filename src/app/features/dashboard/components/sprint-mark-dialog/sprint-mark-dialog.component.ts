import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  NOTE_MAX_LENGTH,
  SPRINT_NUMBERS,
  SPRINT_PROJECT_MAX_LENGTH,
  SPRINT_SCORE_MAX,
  normalizeSprintInput,
  type Id,
  type SprintMark,
  type SprintNumber,
  type UpsertSprintInput,
} from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

export interface SprintCandidate {
  readonly id: Id;
  readonly name: string;
  readonly sprints: readonly (SprintMark | null)[];
}

/**
 * Admin-only "Log Sprint Mark" form in a native `<dialog class="sheet">`.
 * Picking an apprentice + sprint that already has a mark pre-fills it (upsert = edit). Validation mirrors the domain rule.
 */
@Component({
  selector: 'ap-sprint-mark-dialog',
  imports: [IconComponent],
  templateUrl: './sprint-mark-dialog.component.html',
  styleUrl: './sprint-mark-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SprintMarkDialogComponent {
  readonly open = input(false);
  readonly candidates = input.required<readonly SprintCandidate[]>();
  readonly submitted = output<UpsertSprintInput>();
  readonly closed = output<void>();

  protected readonly sprintNumbers = SPRINT_NUMBERS;
  protected readonly scoreMax = SPRINT_SCORE_MAX;
  protected readonly projectMax = SPRINT_PROJECT_MAX_LENGTH;
  protected readonly summaryMax = NOTE_MAX_LENGTH;

  protected readonly apprenticeId = signal<Id | null>(null);
  protected readonly sprintNumber = signal<SprintNumber>(1);
  protected readonly projectName = signal('');
  protected readonly score = signal<number | null>(null);
  protected readonly summary = signal('');
  protected readonly touched = signal(false);

  private readonly candidate = computed(() => this.candidates().find((c) => c.id === this.apprenticeId()) ?? null);
  protected readonly existing = computed(() => this.candidate()?.sprints[this.sprintNumber() - 1] ?? null);

  private readonly draft = computed<UpsertSprintInput | null>(() => {
    const id = this.apprenticeId();
    const score = this.score();
    if (!id) return null;
    return {
      apprenticeId: id,
      sprintNumber: this.sprintNumber(),
      projectName: this.projectName(),
      score: score ?? Number.NaN,
      deliverableSummary: this.summary(),
    };
  });
  protected readonly issues = computed(() => {
    const d = this.draft();
    if (!d) return ['Pick an apprentice.'];
    const r = normalizeSprintInput(d);
    return r.ok ? [] : r.issues;
  });

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      const open = this.open();
      if (open && !el.open) {
        untracked(() => this.reset());
        el.showModal();
      } else if (!open && el.open) el.close();
    });
  }

  private reset(): void {
    this.apprenticeId.set(null);
    this.sprintNumber.set(1);
    this.projectName.set('');
    this.score.set(null);
    this.summary.set('');
    this.touched.set(false);
  }

  /** Default the sprint to the apprentice's next unmarked one, then load whatever mark is there. */
  protected pickApprentice(id: string): void {
    this.apprenticeId.set(id || null);
    const c = this.candidate();
    const next = c ? c.sprints.findIndex((m) => m === null) : 0;
    this.pickSprint(String(next === -1 ? SPRINT_NUMBERS.length : next + 1));
  }

  protected pickSprint(value: string): void {
    this.sprintNumber.set(Number(value) as SprintNumber);
    const m = this.existing();
    this.projectName.set(m?.projectName ?? '');
    this.score.set(m?.score ?? null);
    this.summary.set(m?.deliverableSummary ?? '');
  }

  protected value(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected setScore(raw: string): void {
    this.score.set(raw === '' ? null : Number(raw));
  }

  protected submit(): void {
    this.touched.set(true);
    const d = this.draft();
    if (!d || this.issues().length) return;
    this.submitted.emit(d);
    this.close();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.close();
  }

  protected close(): void {
    this.dialog().nativeElement.close();
  }
}
