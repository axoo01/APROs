import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  NotFoundError,
  ValidationError,
  checkAttendanceDate,
  eodId,
  normalizeEodInput,
  removeOne,
  selectAll,
  selectById,
  upsertMany,
  type EodPacingRecord,
  type Id,
  type IsoDate,
  type UpsertEodInput,
} from '../../../domain';
import { APP_CONFIG } from '../../../core/config/app-config.token';
import { Clock } from '../../../core/platform/clock.service';
import type { DbSchema } from '../../local-db/db-schema.model';
import { LocalDbService } from '../../local-db/local-db.service';
import { ActorContext, type Actor } from '../../ports/actor-context.port';
import { EodRepository } from '../../ports/eod.repository';
import { requireActor } from './local-guards.util';

@Injectable()
export class LocalEodRepository extends EodRepository {
  private readonly db = inject(LocalDbService);
  private readonly clock = inject(Clock);
  private readonly actors = inject(ActorContext);
  private readonly config = inject(APP_CONFIG);

  watchByCohort(cohortId: Id): Observable<readonly EodPacingRecord[]> {
    return this.db.table$('eodPacing').pipe(map((t) => selectAll(t).filter((r) => r.cohortId === cohortId)));
  }

  upsert(input: UpsertEodInput): Observable<EodPacingRecord> {
    return this.upsertMany([input]).pipe(map((records) => records[0]!));
  }

  upsertMany(inputs: readonly UpsertEodInput[]): Observable<readonly EodPacingRecord[]> {
    return this.db.write((db) => {
      const actor = requireActor(this.actors, 'eod.record');
      const now = this.clock.now().toISOString();
      const records = inputs.map((input) => this.build(db, actor, input, now));
      return { db: { ...db, eodPacing: upsertMany(db.eodPacing, records) }, result: records };
    });
  }

  clearMany(apprenticeIds: readonly Id[], date: IsoDate): Observable<void> {
    return this.db.write((db) => {
      requireActor(this.actors, 'eod.record');
      const eodPacing = apprenticeIds.reduce((t, id) => removeOne(t, eodId(id, date)), db.eodPacing);
      return { db: { ...db, eodPacing }, result: undefined };
    });
  }

  private build(db: DbSchema, actor: Actor, input: UpsertEodInput, now: string): EodPacingRecord {
    const normalized = normalizeEodInput(input);
    if (!normalized.ok) throw new ValidationError(normalized.issues[0]!, normalized.issues);

    const apprentice = selectById(db.apprentices, input.apprenticeId);
    if (!apprentice) throw new NotFoundError(`Apprentice ${input.apprenticeId} not found.`);
    const cohort = selectById(db.cohorts, apprentice.cohortId);
    if (!cohort) throw new NotFoundError(`Cohort ${apprentice.cohortId} not found.`);

    // Same working-day policy as attendance (production blocks, Demo Mode allows).
    const dateCheck = checkAttendanceDate(cohort, input.date, { demoMode: this.config.demoMode });
    if (!dateCheck.allowed) {
      throw new ValidationError(`EOD can't be recorded on a ${dateCheck.reason === 'WEEKEND' ? 'weekend' : 'holiday'}.`);
    }

    const id = eodId(apprentice.id, input.date);
    const existing = selectById(db.eodPacing, id);
    return {
      id,
      apprenticeId: apprentice.id,
      cohortId: apprentice.cohortId,
      date: input.date,
      ...normalized.value,
      recordedBy: actor.userId,
      recordedAt: now,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
  }
}
