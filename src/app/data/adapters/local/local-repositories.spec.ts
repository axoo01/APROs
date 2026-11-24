import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ForbiddenError, UnauthenticatedError, ValidationError, type Apprentice, type Cohort } from '../../../domain';
import { AuthService } from '../../../core/auth/auth.service';
import { setupTestApp } from '../../../testing/test-providers';
import { ApprenticeRepository } from '../../ports/apprentice.repository';
import { AttendanceRepository } from '../../ports/attendance.repository';
import { CohortRepository } from '../../ports/cohort.repository';

async function signIn(role: 'ADMIN' | 'COACH') {
  await firstValueFrom(TestBed.inject(AuthService).loginAsPersona(role));
}

async function cohort4(): Promise<Cohort> {
  const all = await firstValueFrom(TestBed.inject(CohortRepository).watchAll());
  return all.find((c) => c.code === '26-11-04')!;
}

async function firstApprentice(c: Cohort): Promise<Apprentice> {
  const list = await firstValueFrom(TestBed.inject(ApprenticeRepository).watchByCohort(c.id));
  return list.find((a) => a.status === 'ACTIVE')!;
}

describe('Local repositories', () => {
  beforeEach(async () => {
    await setupTestApp();
  });

  describe('CohortRepository', () => {
    it('lists newest first', async () => {
      const codes = (await firstValueFrom(TestBed.inject(CohortRepository).watchAll())).map((c) => c.code);
      expect(codes).toEqual(['26-11-04', '26-08-03', '26-05-02', '26-02-01']);
    });

    it('creates with the next per-year sequence and default name (ADMIN)', async () => {
      await signIn('ADMIN');
      const created = await firstValueFrom(
        TestBed.inject(CohortRepository).create({
          phase1StartDate: '2026-12-07',
          phase1EndDate: '2027-03-05',
          phase2StartDate: '2027-03-15',
          phase2EndDate: '2027-06-25',
        }),
      );
      expect(created.code).toBe('26-12-05');
      expect(created.displayName).toBe('Cohort - 26-12-05');
    });

    it('starts a new sequence in a new year', async () => {
      await signIn('ADMIN');
      const created = await firstValueFrom(
        TestBed.inject(CohortRepository).create({
          phase1StartDate: '2027-02-01',
          phase1EndDate: '2027-04-30',
          phase2StartDate: '2027-05-10',
          phase2EndDate: '2027-08-20',
          displayName: 'Spring Cohort',
        }),
      );
      expect(created).toMatchObject({ code: '27-02-01', sequenceNumber: 1, displayName: 'Spring Cohort' });
    });

    it('forbids COACH from creating cohorts', async () => {
      await signIn('COACH');
      await expect(
        firstValueFrom(
          TestBed.inject(CohortRepository).create({
            phase1StartDate: '2026-12-07',
            phase1EndDate: '2027-03-05',
            phase2StartDate: '2027-03-15',
            phase2EndDate: '2027-06-25',
          }),
        ),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('lets ADMIN rename but never re-code; rejects month-changing reschedules', async () => {
      await signIn('ADMIN');
      const repo = TestBed.inject(CohortRepository);
      const c = await cohort4();
      const renamed = await firstValueFrom(repo.update(c.id, { displayName: 'Cohort 4 · Rooftop' }));
      expect(renamed).toMatchObject({ displayName: 'Cohort 4 · Rooftop', code: '26-11-04', sequenceNumber: 4 });
      await expect(firstValueFrom(repo.update(c.id, { phase1StartDate: '2026-10-26' }))).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('AttendanceRepository', () => {
    it('requires authentication', async () => {
      const c = await cohort4();
      const a = await firstApprentice(c);
      await expect(
        firstValueFrom(TestBed.inject(AttendanceRepository).upsert({ apprenticeId: a.id, date: '2026-11-23', status: 'P' })),
      ).rejects.toBeInstanceOf(UnauthenticatedError);
    });

    it('lets COACH record for any apprentice and upserts one record per day', async () => {
      await signIn('COACH');
      const repo = TestBed.inject(AttendanceRepository);
      const c = await cohort4();
      const a = await firstApprentice(c);

      await firstValueFrom(repo.upsert({ apprenticeId: a.id, date: '2026-11-23', status: 'P' }));
      const updated = await firstValueFrom(repo.upsert({ apprenticeId: a.id, date: '2026-11-23', status: 'L', reason: 'TRAFFIC' }));

      const today = await firstValueFrom(repo.watchByCohortOnDate(c.id, '2026-11-23'));
      expect(today.filter((r) => r.apprenticeId === a.id)).toHaveLength(1);
      expect(updated).toMatchObject({ status: 'L', reason: 'TRAFFIC', cohortId: c.id });
    });

    it('batch-marks atomically and clears back to Not Here Yet', async () => {
      await signIn('COACH');
      const repo = TestBed.inject(AttendanceRepository);
      const c = await cohort4();
      const roster = (await firstValueFrom(TestBed.inject(ApprenticeRepository).watchByCohort(c.id))).slice(0, 5);

      await firstValueFrom(repo.upsertMany(roster.map((a) => ({ apprenticeId: a.id, date: '2026-11-23' as const, status: 'A' as const }))));
      expect(await firstValueFrom(repo.watchByCohortOnDate(c.id, '2026-11-23'))).toHaveLength(5);

      await firstValueFrom(repo.clear(roster[0]!.id, '2026-11-23'));
      expect(await firstValueFrom(repo.watchByCohortOnDate(c.id, '2026-11-23'))).toHaveLength(4);
    });

    it('rejects the whole batch if one entry is invalid', async () => {
      await signIn('COACH');
      const repo = TestBed.inject(AttendanceRepository);
      const c = await cohort4();
      const a = await firstApprentice(c);
      await expect(
        firstValueFrom(
          repo.upsertMany([
            { apprenticeId: a.id, date: '2026-11-23', status: 'P' },
            { apprenticeId: a.id, date: '2026-11-24', status: 'E' }, // E without reason
          ]),
        ),
      ).rejects.toBeInstanceOf(ValidationError);
      expect(await firstValueFrom(repo.watchByCohortOnDate(c.id, '2026-11-23'))).toHaveLength(0);
    });

    it('allows weekends in Demo Mode', async () => {
      await signIn('COACH');
      const c = await cohort4();
      const a = await firstApprentice(c);
      const r = await firstValueFrom(TestBed.inject(AttendanceRepository).upsert({ apprenticeId: a.id, date: '2026-11-21', status: 'P' }));
      expect(r.date).toBe('2026-11-21');
    });
  });

  describe('ApprenticeRepository', () => {
    it('lets ADMIN assign/unassign coaches and forbids COACH', async () => {
      const c = await cohort4();
      const a = await firstApprentice(c);
      const repo = TestBed.inject(ApprenticeRepository);

      await signIn('COACH');
      await expect(firstValueFrom(repo.assignCoach(a.id, null))).rejects.toBeInstanceOf(ForbiddenError);

      await signIn('ADMIN');
      expect((await firstValueFrom(repo.assignCoach(a.id, null))).coachId).toBeNull();
    });
  });
});

describe('AttendanceRepository (production mode)', () => {
  beforeEach(async () => {
    await setupTestApp({ demoMode: false });
  });

  it('blocks non-working days outside Demo Mode', async () => {
    // Persona login is demo-only, so sign in by email.
    await firstValueFrom(TestBed.inject(AuthService).loginWithEmail('kwesi.appiah@apros.demo'));
    const c = await cohort4();
    const a = await firstApprentice(c);
    await expect(
      firstValueFrom(TestBed.inject(AttendanceRepository).upsert({ apprenticeId: a.id, date: '2026-12-25', status: 'P' })),
    ).rejects.toThrow("Attendance can't be recorded on a holiday.");
  });
});
