import { Injectable, computed, inject } from '@angular/core';
import {
  bucketOf,
  checkAttendanceDate,
  type Apprentice,
  type AttendanceBucket,
  type AttendanceRecord,
  type Id,
  type IsoDate,
} from '../../../domain';
import { APP_CONFIG } from '../../../core/config/app-config.token';
import { CohortContextStore } from '../../../core/state/cohort-context.store';
import { ReferenceDataStore } from '../../../core/state/reference-data.store';
import { Clock } from '../../../core/platform/clock.service';
import { ApprenticeRepository } from '../../../data/ports/apprentice.repository';
import { AttendanceRepository } from '../../../data/ports/attendance.repository';
import { streamFor } from '../../../shared/utils/stream-for.util';

/** Read model for today's attendance in the active cohort. The Sweep screen (next step) builds on this. */
@Injectable()
export class AttendanceTodayFacade {
  private readonly ctx = inject(CohortContextStore);
  private readonly refs = inject(ReferenceDataStore);
  private readonly clock = inject(Clock);
  private readonly config = inject(APP_CONFIG);
  private readonly apprenticeRepo = inject(ApprenticeRepository);
  private readonly attendanceRepo = inject(AttendanceRepository);

  readonly cohort = this.ctx.activeCohort;
  readonly date = this.clock.today;

  private readonly cohortId = computed(() => this.cohort()?.id ?? null);
  private readonly cohortDay = computed(() => {
    const id = this.cohortId();
    return id ? { cohortId: id, date: this.date() } : null;
  });

  private readonly apprentices = streamFor(
    this.cohortId,
    (id) => this.apprenticeRepo.watchByCohort(id),
    [] as readonly Apprentice[],
  );
  private readonly records = streamFor(
    this.cohortDay,
    (q: { cohortId: Id; date: IsoDate }) => this.attendanceRepo.watchByCohortOnDate(q.cohortId, q.date),
    [] as readonly AttendanceRecord[],
  );

  readonly roster = computed(() => this.apprentices().filter((a) => a.status === 'ACTIVE'));
  private readonly recordByApprentice = computed(() => new Map(this.records().map((r) => [r.apprenticeId, r])));

  readonly buckets = computed(() => {
    const counts: Record<AttendanceBucket, number> = { NOT_HERE_YET: 0, PRESENT: 0, ABSENT_EXCUSED: 0 };
    const byId = this.recordByApprentice();
    for (const a of this.roster()) counts[bucketOf(byId.get(a.id)?.status)] += 1;
    return counts;
  });

  readonly bySpecialization = computed(() => {
    const specs = this.refs.specializationById();
    const groups = new Map<Id, number>();
    for (const a of this.roster()) groups.set(a.specializationId, (groups.get(a.specializationId) ?? 0) + 1);
    return [...groups.entries()]
      .map(([id, count]) => ({ specialization: specs.get(id), count }))
      .filter((g) => g.specialization !== undefined)
      .sort((a, b) => b.count - a.count);
  });

  readonly dateCheck = computed(() => {
    const c = this.cohort();
    return c ? checkAttendanceDate(c, this.date(), { demoMode: this.config.demoMode }) : null;
  });
}

