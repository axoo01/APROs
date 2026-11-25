import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  computed,
  effect,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Id } from '../../../../domain';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import type { SweepEntry } from '../../data-access/attendance.facade';

/** Confirms the closeout: lists who will be marked Absent; tap a name to keep them "Not Here Yet". */
@Component({
  selector: 'ap-closeout-sheet',
  imports: [IconComponent],
  templateUrl: './closeout-sheet.component.html',
  styleUrl: './closeout-sheet.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloseoutSheetComponent {
  readonly entries = input.required<readonly SweepEntry[]>();
  readonly open = model(false);
  /** Emits the ids the coach chose to keep as "Not Here Yet". */
  readonly confirmed = output<ReadonlySet<Id>>();

  protected readonly tagColor = colorTagVar;
  protected readonly excluded = signal<ReadonlySet<Id>>(new Set());
  protected readonly markCount = computed(() => this.entries().filter((e) => !this.excluded().has(e.id)).length);

  protected readonly groups = computed(() => {
    const map = new Map<string, SweepEntry[]>();
    for (const e of this.entries()) {
      const key = e.specialization?.id ?? '';
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.values()].map((entries) => ({ specialization: entries[0]?.specialization, entries }));
  });

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.open() && !el.open) {
        this.excluded.set(new Set());
        el.showModal();
      } else if (!this.open() && el.open) el.close();
    });
  }

  protected toggle(id: Id): void {
    this.excluded.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected confirm(): void {
    this.confirmed.emit(this.excluded());
    this.open.set(false);
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.open.set(false);
  }
}
