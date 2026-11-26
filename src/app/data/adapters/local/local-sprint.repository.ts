import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  NotFoundError,
  ValidationError,
  normalizeSprintInput,
  selectAll,
  selectById,
  sprintMarkId,
  upsertOne,
  type Id,
  type SprintMark,
  type UpsertSprintInput,
} from '../../../domain';
import { Clock } from '../../../core/platform/clock.service';
import { LocalDbService } from '../../local-db/local-db.service';
import { ActorContext } from '../../ports/actor-context.port';
import { SprintRepository } from '../../ports/sprint.repository';
import { requireActor } from './local-guards.util';

@Injectable()
export class LocalSprintRepository extends SprintRepository {
  private readonly db = inject(LocalDbService);
  private readonly clock = inject(Clock);
  private readonly actors = inject(ActorContext);

  watchByCohort(cohortId: Id): Observable<readonly SprintMark[]> {
    return this.db.table$('sprintMarks').pipe(map((t) => selectAll(t).filter((m) => m.cohortId === cohortId)));
  }

  upsert(input: UpsertSprintInput): Observable<SprintMark> {
    return this.db.write((db) => {
      const actor = requireActor(this.actors, 'sprint.record');
      const normalized = normalizeSprintInput(input);
      if (!normalized.ok) throw new ValidationError(normalized.issues[0]!, normalized.issues);
      const apprentice = selectById(db.apprentices, input.apprenticeId);
      if (!apprentice) throw new NotFoundError(`Apprentice ${input.apprenticeId} not found.`);

      const now = this.clock.now().toISOString();
      const id = sprintMarkId(apprentice.id, normalized.value.sprintNumber);
      const existing = selectById(db.sprintMarks, id);
      const mark: SprintMark = {
        id,
        apprenticeId: apprentice.id,
        cohortId: apprentice.cohortId,
        ...normalized.value,
        recordedBy: actor.userId,
        recordedAt: now,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      return { db: { ...db, sprintMarks: upsertOne(db.sprintMarks, mark) }, result: mark };
    });
  }
}
