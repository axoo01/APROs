import { Injectable, inject } from '@angular/core';
import { Observable, defer, from } from 'rxjs';
import { KeyValueStorage, BrowserStorage } from '../../../core/platform/key-value-storage.service';
import { LocalDbService } from '../../local-db/local-db.service';
import { ActorContext } from '../../ports/actor-context.port';
import { DemoDataPort } from '../../ports/demo-data.port';
import { requireActor } from './local-guards.util';

@Injectable()
export class LocalDemoData extends DemoDataPort {
  private readonly db = inject(LocalDbService);
  private readonly actors = inject(ActorContext);
  private readonly storage = inject(KeyValueStorage);

  get isPersistent(): boolean {
    return this.storage instanceof BrowserStorage ? this.storage.isPersistent : false;
  }

  reset(): Observable<void> {
    return defer(() => {
      requireActor(this.actors, 'demo.reset');
      return from(this.db.resetToSeed());
    });
  }
}
