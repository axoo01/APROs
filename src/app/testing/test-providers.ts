import { ApplicationInitStatus, type EnvironmentProviders, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_CONFIG, type AppConfig } from '../core/config/app-config.token';
import { AuthService } from '../core/auth/auth.service';
import { DemoAuthService } from '../core/auth/demo-auth.service';
import { Clock, FixedClock } from '../core/platform/clock.service';
import { KeyValueStorage, MemoryStorage } from '../core/platform/key-value-storage.service';
import { ActorContext } from '../data/ports/actor-context.port';
import { provideDataLayer } from '../data/data.providers';

/** Monday of Week 4, Cohort 26-11-04, 10:00 local. */
export const TEST_NOW = new Date(2026, 10, 23, 10, 0, 0);

export interface TestEnv {
  readonly clock: FixedClock;
  readonly storage: MemoryStorage;
}

/** Full core + local data layer with deterministic time, in-memory storage and zero latency. */
export function provideTestApp(
  overrides: Partial<AppConfig> = {},
  env: TestEnv = { clock: new FixedClock(TEST_NOW), storage: new MemoryStorage() },
): (Provider | EnvironmentProviders)[] {
  return [
    { provide: Clock, useValue: env.clock },
    { provide: KeyValueStorage, useValue: env.storage },
    { provide: APP_CONFIG, useValue: { demoMode: true, simulatedLatencyMs: 0, persistDebounceMs: 0, ...overrides } },
    { provide: AuthService, useClass: DemoAuthService },
    { provide: ActorContext, useExisting: AuthService },
    provideDataLayer('local'),
  ];
}

/** Configures TestBed and runs app initializers (LocalDbService.init → seed). */
export async function setupTestApp(
  overrides: Partial<AppConfig> = {},
  env?: TestEnv,
  extraProviders: (Provider | EnvironmentProviders)[] = [],
): Promise<void> {
  TestBed.configureTestingModule({ providers: [...provideTestApp(overrides, env), ...extraProviders] });
  await TestBed.inject(ApplicationInitStatus).donePromise;
}
