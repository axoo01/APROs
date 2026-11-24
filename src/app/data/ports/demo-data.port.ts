import type { Observable } from 'rxjs';

/** Demo-environment controls. The REST adapter will not provide this (or will no-op). */
export abstract class DemoDataPort {
  /** Whether changes survive a reload (false in private browsing / blocked storage). */
  abstract readonly isPersistent: boolean;
  abstract reset(): Observable<void>;
}
