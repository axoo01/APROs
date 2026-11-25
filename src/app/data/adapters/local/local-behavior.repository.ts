import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  NotFoundError,
  ValidationError,
  behaviorId,
  normalizeBehaviorInput,
  removeOne,
  selectAll,
  selectById,
  upsertMany,
  type Id,
  type IsoDate,
  type UpsertBehaviorInput,
  type WeeklyBehaviorRecord,
} from '../../../domain';
import { Clock } from '../../../core/platform/clock.service';
import type { DbSchema } from '../../local-db/db-schema.model';
import { LocalDbService } from '../../local-db/local-db.service';
import { ActorContext, type Actor } from '../../ports/actor-context.port';
import { BehaviorRepository } from '../../ports/behavior.repository';
import { requireActor } from './local-guards.util';

@Injectable()
export class LocalBehaviorRepository extends BehaviorRepository {
  private readonly db = inject(LocalDbService);
  private readonly clock = inject(Clock);
  private readonly actors = inject(ActorContext);

  watchByCohort(cohortId: Id): Observable<readonly WeeklyBehaviorRecord[]> {
    return this.db.table$('weeklyBehavior').pipe(map((t) => selectAll(t).filter((r) => r.cohortId === cohortId)));
  }

  upsertMany(inputs: readonly UpsertBehaviorInput[]): Observable<readonly WeeklyBehaviorRecord[]> {
    return this.db.write((db) => {
      const actor = requireActor(this.actors, 'behavior.record');
      const now = this.clock.now().toISOString();
      const records = inputs.map((input) => this.build(db, actor, input, now));
      return { db: { ...db, weeklyBehavior: upsertMany(db.weeklyBehavior, records) }, result: records };
    });
  }

  clearMany(apprenticeIds: readonly Id[], weekStart: IsoDate): Observable<void> {
    return this.db.write((db) => {
      requireActor(this.actors, 'behavior.record');
      const weeklyBehavior = apprenticeIds.reduce((t, id) => removeOne(t, behaviorId(id, weekStart)), db.weeklyBehavior);
      return { db: { ...db, weeklyBehavior }, result: undefined };
    });
  }

  private build(db: DbSchema, actor: Actor, input: UpsertBehaviorInput, now: string): WeeklyBehaviorRecord {
    const normalized = normalizeBehaviorInput(input);
    if (!normalized.ok) throw new ValidationError(normalized.issues[0]!, normalized.issues);
    const apprentice = selectById(db.apprentices, input.apprenticeId);
    if (!apprentice) throw new NotFoundError(`Apprentice ${input.apprenticeId} not found.`);

    const id = behaviorId(apprentice.id, input.weekStart);
    const existing = selectById(db.weeklyBehavior, id);
    return {
      id,
      apprenticeId: apprentice.id,
      cohortId: apprentice.cohortId,
      weekStart: input.weekStart,
      ...normalized.value,
      recordedBy: actor.userId,
      recordedAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }
}
