import { DOCUMENT, DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';

/** Emits when a pointerdown happens outside the host (menus, popovers). */
@Directive({ selector: '[apClickOutside]' })
export class ClickOutsideDirective {
  readonly enabled = input(true, { alias: 'apClickOutsideEnabled' });
  readonly apClickOutside = output<void>();

  constructor() {
    const host = inject(ElementRef<HTMLElement>).nativeElement as HTMLElement;
    const doc = inject(DOCUMENT);
    const handler = (e: PointerEvent) => {
      if (this.enabled() && e.target instanceof Node && !host.contains(e.target)) this.apClickOutside.emit();
    };
    doc.addEventListener('pointerdown', handler, true);
    inject(DestroyRef).onDestroy(() => doc.removeEventListener('pointerdown', handler, true));
  }
}
