import { DOCUMENT, DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { KeyValueStorage } from '../platform/key-value-storage.service';

export type ThemePreference = 'system' | 'light' | 'dark';
/** Must match the inline pre-paint script in index.html. */
const THEME_KEY = 'apros.theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(KeyValueStorage);
  private readonly media = this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)') ?? null;
  private readonly systemDark = signal(this.media?.matches ?? false);

  readonly preference = signal<ThemePreference>(this.read());
  readonly isDark = computed(() =>
    this.preference() === 'system' ? this.systemDark() : this.preference() === 'dark',
  );

  constructor() {
    const onChange = (e: MediaQueryListEvent) => this.systemDark.set(e.matches);
    this.media?.addEventListener('change', onChange);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('change', onChange));

    effect(() => {
      this.document.documentElement.classList.toggle('dark', this.isDark());
      this.storage.setItem(THEME_KEY, this.preference());
    });
  }

  set(pref: ThemePreference): void {
    this.preference.set(pref);
  }

  private read(): ThemePreference {
    const v = this.storage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  }
}
