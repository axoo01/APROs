import { InjectionToken } from '@angular/core';

export interface AppConfig {
  /** Enables persona login, role switching, reset, and any-date attendance recording. */
  readonly demoMode: boolean;
  /** Artificial latency applied to local writes so loading/optimistic states are exercised. */
  readonly simulatedLatencyMs: number;
  /** Debounce for persisting the local store. */
  readonly persistDebounceMs: number;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  demoMode: true,
  simulatedLatencyMs: 120,
  persistDebounceMs: 150,
};

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_APP_CONFIG,
});
