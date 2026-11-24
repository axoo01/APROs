import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  NotFoundError,
  ValidationError,
  attendanceId,
  checkAttendanceDate,
  normalizeAttendanceInput,
  removeOne,
  selectAll,
  selectById,
  upsertMany,
  type AttendanceRecord,
  type Id,
  type IsoDate,
  type UpsertAttendanceInput,
} from '../../../domain';
import { APP_CONFIG } from '../../../core/config/app-config.token';
import { Clock } from '../../../core/platform/clock.service';
import type { DbSchema } from '../../local-db/db-schema.model';
import { LocalDbService } from '../../local-db/local-db.service';
import type { Actor } from '../../ports/actor-context.port';
import { ActorContext } from '../../ports/actor-context.port';
import { AttendanceRepository } from '../../ports/attendance.repository';
import { requireActor } from './local-guards.util';

@Injectable()
export class LocalAttendanceRepository extends AttendanceRepository {
  private readonly db = inject(LocalDbService);
  private readonly clock = inject(Clock);
  private readonly actors = inject(ActorContext);
  private readonly config = inject(APP_CONFIG);

  watchByCohort(cohortId: Id): Observable<readonly AttendanceRecord[]> {
    return this.db.table$('attendance').pipe(map((t) => selectAll(t).filter((r) => r.cohortId === cohortId)));
  }

  watchByCohortOnDate(cohortId: Id, date: IsoDate): Observable<readonly AttendanceRecord[]> {
    return this.db
      .table$('attendance')
      .pipe(map((t) => selectAll(t).filter((r) => r.cohortId === cohortId && r.date === date)));
  }

  upsert(input: UpsertAttendanceInput): Observable<AttendanceRecord> {
    return this.upsertMany([input]).pipe(map((records) => records[0]!));
  }

  upsertMany(inputs: readonly UpsertAttendanceInput[]): Observable<readonly AttendanceRecord[]> {
    return this.db.write((db) => {
      const actor = requireActor(this.actors, 'attendance.record');
      const now = this.clock.now().toISOString();
      const records = inputs.map((input) => this.build(db, actor, input, now));
      return { db: { ...db, attendance: upsertMany(db.attendance, records) }, result: records };
    });
  }

  clear(apprenticeId: Id, date: IsoDate): Observable<void> {
    return this.db.write((db) => {
      requireActor(this.actors, 'attendance.record');
      return { db: { ...db, attendance: removeOne(db.attendance, attendanceId(apprenticeId, date)) }, result: undefined };
    });
  }

  private build(db: DbSchema, actor: Actor, input: UpsertAttendanceInput, now: string): AttendanceRecord {
    const normalized = normalizeAttendanceInput(input);
    if (!normalized.ok) throw new ValidationError(normalized.issues[0]!, normalized.issues);

    const apprentice = selectById(db.apprentices, input.apprenticeId);
    if (!apprentice) throw new NotFoundError(`Apprentice ${input.apprenticeId} not found.`);
    const cohort = selectById(db.cohorts, apprentice.cohortId);
    if (!cohort) throw new NotFoundError(`Cohort ${apprentice.cohortId} not found.`);

    const dateCheck = checkAttendanceDate(cohort, input.date, { demoMode: this.config.demoMode });
    if (!dateCheck.allowed) {
      throw new ValidationError(`Attendance can't be recorded on a ${dateCheck.reason === 'WEEKEND' ? 'weekend' : 'holiday'}.`);
    }

    const id = attendanceId(apprentice.id, input.date);
    const existing = selectById(db.attendance, id);
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
