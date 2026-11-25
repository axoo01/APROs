import { DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';

const MOVE_TOLERANCE_PX = 10;

/**
 * Emits `apLongPress` after holding a pointer for `apLongPressMs` (touch/pen/mouse), or on right-click.
 * The click that follows a long press is swallowed, so a host `(click)` keeps meaning "tap".
 * Keyboard users get the same action through an explicit button — this is a shortcut, not the only path.
 */
@Directive({
  selector: '[apLongPress]',
  host: {
    '(pointerdown)': 'start($event)',
    '(pointermove)': 'move($event)',
    '(pointerup)': 'cancel()',
    '(pointercancel)': 'cancel()',
    '(pointerleave)': 'cancel()',
    '(contextmenu)': 'contextMenu($event)',
    style: '-webkit-touch-callout: none; touch-action: manipulation;',
  },
})
export class LongPressDirective {
  readonly apLongPressMs = input(450);
  readonly apLongPress = output<void>();

  private timer: ReturnType<typeof setTimeout> | null = null;
  private origin: { x: number; y: number } | null = null;
  private suppressClick = false;

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // Capture phase on the target runs before the host's own (click) bindings.
    const swallow = (e: MouseEvent) => {
      if (!this.suppressClick) return;
      this.suppressClick = false;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    el.addEventListener('click', swallow, { capture: true });
    inject(DestroyRef).onDestroy(() => {
      el.removeEventListener('click', swallow, { capture: true });
      this.cancel();
    });
  }

  protected start(e: PointerEvent): void {
    if (e.button !== 0) return;
    this.cancel();
    this.suppressClick = false;
    this.origin = { x: e.clientX, y: e.clientY };
    this.timer = setTimeout(() => this.fire(), this.apLongPressMs());
  }

  protected move(e: PointerEvent): void {
    if (!this.origin) return;
    if (Math.hypot(e.clientX - this.origin.x, e.clientY - this.origin.y) > MOVE_TOLERANCE_PX) this.cancel();
  }

  protected cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.origin = null;
  }

  protected contextMenu(e: MouseEvent): void {
    e.preventDefault();
    if (this.timer) this.fire(true); // touch press still held: fire early, swallow the release click
    else if (!this.suppressClick) this.fire(false); // mouse right-click: no click follows
    // else: the long-press timer already fired for this press.
  }

  private fire(swallowNextClick = true): void {
    this.cancel();
    this.suppressClick = swallowNextClick;
    navigator.vibrate?.(12);
    this.apLongPress.emit();
  }
}
