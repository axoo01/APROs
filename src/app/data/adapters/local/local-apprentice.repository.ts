import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  NotFoundError,
  ValidationError,
  apprenticeDisplayName,
  selectAll,
  selectById,
  upsertOne,
  type Apprentice,
  type Id,
} from '../../../domain';
import { Clock } from '../../../core/platform/clock.service';
import { LocalDbService } from '../../local-db/local-db.service';
import { ActorContext } from '../../ports/actor-context.port';
import { ApprenticeRepository } from '../../ports/apprentice.repository';
import { requireActor } from './local-guards.util';

@Injectable()
export class LocalApprenticeRepository extends ApprenticeRepository {
  private readonly db = inject(LocalDbService);
  private readonly clock = inject(Clock);
  private readonly actors = inject(ActorContext);

  watchByCohort(cohortId: Id): Observable<readonly Apprentice[]> {
    return this.db.table$('apprentices').pipe(
      map((t) =>
        selectAll(t)
          .filter((a) => a.cohortId === cohortId)
          .sort((a, b) => apprenticeDisplayName(a).localeCompare(apprenticeDisplayName(b))),
      ),
    );
  }

  assignCoach(apprenticeId: Id, coachId: Id | null): Observable<Apprentice> {
    return this.db.write((db) => {
      requireActor(this.actors, 'apprentice.assign');
      const current = selectById(db.apprentices, apprenticeId);
      if (!current) throw new NotFoundError(`Apprentice ${apprenticeId} not found.`);
      if (coachId !== null) {
        const coach = selectById(db.users, coachId);
        if (!coach?.isActive) throw new ValidationError('Coach must be an active user.');
      }
      const next: Apprentice = { ...current, coachId, updatedAt: this.clock.now().toISOString() };
      return { db: { ...db, apprentices: upsertOne(db.apprentices, next) }, result: next };
    });
  }
}
