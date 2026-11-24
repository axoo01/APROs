import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { ActorContext } from '../data/ports/actor-context.port';
import { AuthService } from './auth/auth.service';
import { DemoAuthService } from './auth/demo-auth.service';
import { Clock, SystemClock } from './platform/clock.service';
import { BrowserStorage, KeyValueStorage } from './platform/key-value-storage.service';

/** Cross-cutting platform services: time, storage, authentication, and the actor seen by adapters. */
export function provideCore(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: Clock, useClass: SystemClock },
    { provide: KeyValueStorage, useClass: BrowserStorage },
    { provide: AuthService, useClass: DemoAuthService },
    { provide: ActorContext, useExisting: AuthService },
  ]);
}
