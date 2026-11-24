import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { colorTagForId, colorTagVar } from '../../utils/color-tag.util';

/** Initials avatar on a deterministic brand tint (photo support via `src`). */
@Component({
  selector: 'ap-avatar',
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.css',
  host: {
    class: 'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.38',
    '[style.background-color]': 'bg()',
    '[style.color]': 'fg()',
    '[attr.role]': "src() ? null : 'img'",
    '[attr.aria-label]': 'src() ? null : name()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  /** Stable seed for the tint (usually the entity id). */
  readonly seed = input<string>('');
  readonly src = input<string | null>(null);
  readonly size = input(36);

  protected readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    return (first + last).toUpperCase();
  });

  private readonly tag = computed(() => colorTagForId(this.seed() || this.name()));
  protected readonly bg = computed(() => colorTagVar(this.tag(), 100));
  protected readonly fg = computed(() => colorTagVar(this.tag(), 900));
}
