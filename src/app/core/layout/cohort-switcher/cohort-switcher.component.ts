import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, type ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import type { Cohort } from '../../../domain';
import { ClickOutsideDirective } from '../../../shared/directives/click-outside.directive';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { PhasePillComponent } from '../../../shared/components/phase-pill/phase-pill.component';
import { CohortContextStore } from '../../state/cohort-context.store';

/** Listbox-pattern cohort picker: dropdown on desktop, bottom sheet on mobile. */
@Component({
  selector: 'ap-cohort-switcher',
  imports: [DatePipe, IconComponent, PhasePillComponent, ClickOutsideDirective],
  templateUrl: './cohort-switcher.component.html',
  styleUrl: './cohort-switcher.component.css',
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CohortSwitcherComponent {
  protected readonly ctx = inject(CohortContextStore);
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(0);
  protected readonly activeOptionId = computed(() => {
    const c = this.ctx.cohorts()[this.activeIndex()];
    return c ? `cohort-opt-${c.id}` : null;
  });

  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly listbox = viewChild<ElementRef<HTMLUListElement>>('listbox');

  protected toggle(): void {
    if (this.open()) this.close();
    else this.show();
  }

  protected close(returnFocus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (returnFocus) this.trigger().nativeElement.focus();
  }

  protected choose(c: Cohort): void {
    this.ctx.select(c.id);
    this.close(true);
  }

  protected onTriggerKey(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.show();
    }
  }

  protected onListKey(e: KeyboardEvent): void {
    const count = this.ctx.cohorts().length;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.activeIndex.update((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.activeIndex.update((i) => (i - 1 + count) % count);
        break;
      case 'Home':
        e.preventDefault();
        this.activeIndex.set(0);
        break;
      case 'End':
        e.preventDefault();
        this.activeIndex.set(count - 1);
        break;
      case 'Enter':
      case ' ': {
        e.preventDefault();
        const c = this.ctx.cohorts()[this.activeIndex()];
        if (c) this.choose(c);
        break;
      }
      case 'Escape':
      case 'Tab':
        this.close(e.key === 'Escape');
        break;
    }
  }

  private show(): void {
    const idx = this.ctx.cohorts().findIndex((c) => c.id === this.ctx.activeCohort()?.id);
    this.activeIndex.set(Math.max(0, idx));
    this.open.set(true);
    queueMicrotask(() => this.listbox()?.nativeElement.focus());
  }
}
