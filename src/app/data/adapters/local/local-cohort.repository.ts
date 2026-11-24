import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  deriveCohortIdentity,
  selectAll,
  selectById,
  upsertOne,
  validateCohortDates,
  validateDisplayName,
  validateLockedIdentity,
  type Cohort,
  type CreateCohortInput,
  type Id,
  type UpdateCohortInput,
} from '../../../domain';
import { Clock } from '../../../core/platform/clock.service';
import { LocalDbService } from '../../local-db/local-db.service';
import { ActorContext } from '../../ports/actor-context.port';
import { CohortRepository } from '../../ports/cohort.repository';
import { requireActor } from './local-guards.util';

@Injectable()
export class LocalCohortRepository extends CohortRepository {
  private readonly db = inject(LocalDbService);
  private readonly clock = inject(Clock);
  private readonly actors = inject(ActorContext);

  watchAll(): Observable<readonly Cohort[]> {
    return this.db.table$('cohorts').pipe(
      map((t) => selectAll(t).sort((a, b) => b.phase1StartDate.localeCompare(a.phase1StartDate))),
    );
  }

  create(input: CreateCohortInput): Observable<Cohort> {
    return this.db.write((db) => {
      requireActor(this.actors, 'cohort.create');
      const issues = validateCohortDates(input);
      if (issues.length) throw new ValidationError(issues[0]!, issues);

      const existing = selectAll(db.cohorts);
      const identity = deriveCohortIdentity(existing, input.phase1StartDate);
      if (existing.some((c) => c.code === identity.code)) {
        throw new ConflictError(`Cohort code ${identity.code} already exists.`);
      }
      const displayName = input.displayName?.trim() || identity.defaultDisplayName;
      const nameIssues = validateDisplayName(displayName);
      if (nameIssues.length) throw new ValidationError(nameIssues[0]!, nameIssues);

      const now = this.clock.now().toISOString();
      const cohort: Cohort = {
        id: crypto.randomUUID(),
        code: identity.code,
        year: identity.year,
        month: identity.month,
        sequenceNumber: identity.sequenceNumber,
        displayName,
        phase1StartDate: input.phase1StartDate,
        phase1EndDate: input.phase1EndDate,
        phase2StartDate: input.phase2StartDate,
        phase2EndDate: input.phase2EndDate,
        nonWorkingDays: [...(input.nonWorkingDays ?? [])].sort(),
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      };
      return { db: { ...db, cohorts: upsertOne(db.cohorts, cohort) }, result: cohort };
    });
  }

  update(id: Id, patch: UpdateCohortInput): Observable<Cohort> {
    return this.db.write((db) => {
      requireActor(this.actors, 'cohort.update');
      const current = selectById(db.cohorts, id);
      if (!current) throw new NotFoundError(`Cohort ${id} not found.`);

      // Whitelist mutable fields: identity (code/year/month/sequence) can never be patched.
      const next: Cohort = {
        ...current,
        displayName: patch.displayName?.trim() ?? current.displayName,
        phase1StartDate: patch.phase1StartDate ?? current.phase1StartDate,
        phase1EndDate: patch.phase1EndDate ?? current.phase1EndDate,
        phase2StartDate: patch.phase2StartDate ?? current.phase2StartDate,
        phase2EndDate: patch.phase2EndDate ?? current.phase2EndDate,
        nonWorkingDays: patch.nonWorkingDays ? [...patch.nonWorkingDays].sort() : current.nonWorkingDays,
        isArchived: patch.isArchived ?? current.isArchived,
        updatedAt: this.clock.now().toISOString(),
      };
      const issues = [
        ...validateCohortDates(next),
        ...validateLockedIdentity(current, next.phase1StartDate),
        ...validateDisplayName(next.displayName),
      ];
      if (issues.length) throw new ValidationError(issues[0]!, issues);
      return { db: { ...db, cohorts: upsertOne(db.cohorts, next) }, result: next };
    });
  }
}
