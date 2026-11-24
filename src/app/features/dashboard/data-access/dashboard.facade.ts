import { Injectable, computed, inject } from '@angular/core';
import {
  apprenticeDisplayName,
  summarizeAttendance,
  type Apprentice,
  type AttendanceRecord,
  type Id,
} from '../../../domain';
import { CohortContextStore } from '../../../core/state/cohort-context.store';
import { ReferenceDataStore } from '../../../core/state/reference-data.store';
import { ApprenticeRepository } from '../../../data/ports/apprentice.repository';
import { AttendanceRepository } from '../../../data/ports/attendance.repository';
import { streamFor } from '../../../shared/utils/stream-for.util';

const AT_RISK_ATTENDANCE = 0.85;

/** Cohort-to-date attendance health. All math delegated to pure domain rules. */
@Injectable()
export class DashboardFacade {
  private readonly ctx = inject(CohortContextStore);
  private readonly refs = inject(ReferenceDataStore);
  private readonly apprenticeRepo = inject(ApprenticeRepository);
  private readonly attendanceRepo = inject(AttendanceRepository);

  readonly cohort = this.ctx.activeCohort;
  private readonly cohortId = computed(() => this.cohort()?.id ?? null);

  private readonly apprentices = streamFor(this.cohortId, (id) => this.apprenticeRepo.watchByCohort(id), [] as readonly Apprentice[]);
  private readonly records = streamFor(this.cohortId, (id) => this.attendanceRepo.watchByCohort(id), [] as readonly AttendanceRecord[]);

  readonly activeCount = computed(() => this.apprentices().filter((a) => a.status === 'ACTIVE').length);
  readonly unassignedCount = computed(
    () => this.apprentices().filter((a) => a.status === 'ACTIVE' && a.coachId === null).length,
  );
  readonly summary = computed(() => summarizeAttendance(this.records()));
  readonly daysRecorded = computed(() => new Set(this.records().map((r) => r.date)).size);

  private readonly recordsByApprentice = computed(() => {
    const map = new Map<Id, AttendanceRecord[]>();
    for (const r of this.records()) {
      const list = map.get(r.apprenticeId);
      if (list) list.push(r);
      else map.set(r.apprenticeId, [r]);
    }
    return map;
  });

  readonly bySpecialization = computed(() => {
    const byApprentice = this.recordsByApprentice();
    const groups = new Map<Id, AttendanceRecord[]>();
    for (const a of this.apprentices()) {
      if (a.status !== 'ACTIVE') continue;
      const list = groups.get(a.specializationId) ?? [];
      list.push(...(byApprentice.get(a.id) ?? []));
      groups.set(a.specializationId, list);
    }
    const specs = this.refs.specializationById();
    return [...groups.entries()]
      .map(([id, recs]) => ({ specialization: specs.get(id), summary: summarizeAttendance(recs) }))
      .filter((g) => g.specialization !== undefined)
      .sort((a, b) => b.summary.attendanceRate - a.summary.attendanceRate);
  });

  readonly atRisk = computed(() => {
    const byApprentice = this.recordsByApprentice();
    const specs = this.refs.specializationById();
    return this.apprentices()
      .filter((a) => a.status === 'ACTIVE')
      .map((a) => ({
        apprentice: a,
        name: apprenticeDisplayName(a),
        specialization: specs.get(a.specializationId),
        summary: summarizeAttendance(byApprentice.get(a.id) ?? []),
      }))
      .filter((x) => x.summary.total > 0 && x.summary.attendanceRate < AT_RISK_ATTENDANCE)
      .sort((a, b) => a.summary.attendanceRate - b.summary.attendanceRate)
      .slice(0, 6);
  });
}
