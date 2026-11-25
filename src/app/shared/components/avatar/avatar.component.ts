import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Initials avatar as a unified monochrome frosted badge (translucent slate, 1px border, inner highlight),
 * so avatars never clash with status badges or specialization colours. Photo support via `src`.
 */
@Component({
  selector: 'ap-avatar',
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.css',
  host: {
    class: 'avatar inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold tracking-wide',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.36',
    '[attr.role]': "src() ? null : 'img'",
    '[attr.aria-label]': 'src() ? null : name()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly src = input<string | null>(null);
  readonly size = input(36);

  protected readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
    return (first + last).toUpperCase();
  });
}
