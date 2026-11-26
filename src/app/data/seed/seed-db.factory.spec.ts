import {
  absenceStreak,
  behindStreak,
  type EodStatus,
  attendanceId,
  isWeekend,
  latesThisWeek,
  selectAll,
  type AttendanceStatus,
  type IsoDate,
} from '../../domain';
import { createSeedDb } from './seed-db.factory';
import { DEMO_PERSONAS } from './personas.const';

const NOW = new Date(2026, 10, 23, 10, 0, 0); // Mon 23 Nov 2026

describe('createSeedDb', () => {
  const db = createSeedDb(NOW);
  const cohorts = selectAll(db.cohorts);
  const apprentices = selectAll(db.apprentices);
  const records = selectAll(db.attendance);

  it('is deterministic across resets (same ids, same history)', () => {
    const again = createSeedDb(NOW);
    expect(again.users.ids).toEqual(db.users.ids);
    expect(again.apprentices.ids).toEqual(db.apprentices.ids);
    expect(again.attendance.ids).toEqual(db.attendance.ids);
  });

  it('seeds cohorts 26-02-01 … 26-11-04 with smart names', () => {
    expect(cohorts.map((c) => c.code).sort()).toEqual(['26-02-01', '26-05-02', '26-08-03', '26-11-04']);
    const c4 = cohorts.find((c) => c.code === '26-11-04')!;
    expect(c4.displayName).toBe('Cohort - 26-11-04');
    expect(c4).toMatchObject({ year: 2026, month: 11, sequenceNumber: 4 });
    expect(c4.nonWorkingDays).toContain('2026-12-25');
  });

  it('seeds Cohort 4 with the real roster, six per coach', () => {
    const c4 = cohorts.find((c) => c.code === '26-11-04')!;
    const roster = apprentices.filter((a) => a.cohortId === c4.id);
    expect(roster).toHaveLength(30);
    expect(roster.every((a) => a.status === 'ACTIVE' && a.coachId !== null)).toBe(true);
    expect(new Set(roster.map((a) => a.coachId)).size).toBe(5);
    expect(new Set(roster.map((a) => a.specializationId)).size).toBe(6);
    expect(roster.some((a) => a.firstName === 'Aklile' && a.lastName === 'Seyoum Mamo')).toBe(true);
  });

  it('assigns every apprentice to a coach', () => {
    expect(apprentices.every((a) => a.coachId !== null)).toBe(true);
  });

  it('keeps referential integrity', () => {
    for (const a of apprentices) {
      expect(db.cohorts.entities[a.cohortId]).toBeDefined();
      expect(db.specializations.entities[a.specializationId]).toBeDefined();
      if (a.coachId) expect(db.users.entities[a.coachId]?.role).toBe('COACH');
    }
    for (const r of records) {
      expect(db.apprentices.entities[r.apprenticeId]?.cohortId).toBe(r.cohortId);
      expect(db.users.entities[r.recordedBy]).toBeDefined();
    }
  });

  it('enforces one record per apprentice per day via deterministic ids', () => {
    for (const r of records) expect(r.id).toBe(attendanceId(r.apprenticeId, r.date));
    expect(new Set(records.map((r) => r.id)).size).toBe(records.length);
  });

  it('fills history only on working days up to yesterday — today starts fresh', () => {
    const today: IsoDate = '2026-11-23';
    expect(records.every((r) => r.date < today)).toBe(true);
    expect(records.some((r) => isWeekend(r.date))).toBe(false);
    const c4 = cohorts.find((c) => c.code === '26-11-04')!;
    const c4Days = new Set(records.filter((r) => r.cohortId === c4.id).map((r) => r.date));
    expect(c4Days.size).toBe(15); // 2–20 Nov 2026, weekdays
  });

  it('only gives E records a reason (excusing must be justified)', () => {
    expect(records.filter((r) => r.status === 'E').every((r) => r.reason !== null)).toBe(true);
    expect(records.filter((r) => r.status === 'P').every((r) => r.reason === null)).toBe(true);
  });

  it('includes every demo persona as an active user', () => {
    const emails = new Set(selectAll(db.users).filter((u) => u.isActive).map((u) => u.email));
    for (const p of DEMO_PERSONAS) expect(emails.has(p.email)).toBe(true);
  });

  it('plants absence streaks ending yesterday and repeated lates this week in the live cohort', () => {
    const wednesday = createSeedDb(new Date(2026, 10, 25, 10, 0, 0)); // Wed 25 Nov 2026
    const c4 = selectAll(wednesday.cohorts).find((c) => c.code === '26-11-04')!;
    const byApprentice = new Map<string, Map<IsoDate, AttendanceStatus>>();
    for (const r of selectAll(wednesday.attendance).filter((x) => x.cohortId === c4.id)) {
      const m = byApprentice.get(r.apprenticeId) ?? new Map<IsoDate, AttendanceStatus>();
      byApprentice.set(r.apprenticeId, m.set(r.date, r.status));
    }
    const marks = [...byApprentice.values()];
    const streaks = marks.map((m) => absenceStreak(m, '2026-11-25', c4)).filter((n) => n >= 5);
    const lates = marks.map((m) => latesThisWeek(m, '2026-11-25')).filter((n) => n >= 2);
    expect(streaks.length).toBeGreaterThanOrEqual(3);
    expect(lates.length).toBeGreaterThanOrEqual(3);
  });

  it('caps live-cohort history at the last 20 working days', () => {
    const later = createSeedDb(new Date(2026, 11, 16, 10, 0, 0)); // Wed 16 Dec 2026
    const c4 = selectAll(later.cohorts).find((c) => c.code === '26-11-04')!;
    const days = new Set(selectAll(later.attendance).filter((r) => r.cohortId === c4.id).map((r) => r.date));
    expect(days.size).toBe(20);
    expect([...days].sort().at(-1)).toBe('2026-12-15');
  });

  it('seeds EOD pacing only on present days, with planted behind streaks', () => {
    const wednesday = createSeedDb(new Date(2026, 10, 25, 10, 0, 0));
    const c4 = selectAll(wednesday.cohorts).find((c) => c.code === '26-11-04')!;
    const eod = selectAll(wednesday.eodPacing);
    expect(eod.length).toBeGreaterThan(300);
    for (const r of eod) expect(['P', 'L']).toContain(wednesday.attendance.entities[r.id]?.status);
    expect(eod.some((r) => r.status === 'ON_PACE' && r.tag !== null && r.note)).toBe(true);

    const byApprentice = new Map<string, Map<IsoDate, EodStatus>>();
    for (const r of eod.filter((x) => x.cohortId === c4.id)) {
      const m = byApprentice.get(r.apprenticeId) ?? new Map<IsoDate, EodStatus>();
      byApprentice.set(r.apprenticeId, m.set(r.date, r.status));
    }
    const behind = [...byApprentice.values()].filter((m) => behindStreak(m, '2026-11-25', c4) >= 2);
    expect(behind.length).toBeGreaterThanOrEqual(2);
  });

  it('seeds weekly behavior for prior weeks and only part of the current week', () => {
    const wednesday = createSeedDb(new Date(2026, 10, 25, 10, 0, 0));
    const c4 = selectAll(wednesday.cohorts).find((c) => c.code === '26-11-04')!;
    const ratings = selectAll(wednesday.weeklyBehavior).filter((r) => r.cohortId === c4.id);
    const byWeek = new Map<string, number>();
    for (const r of ratings) byWeek.set(r.weekStart, (byWeek.get(r.weekStart) ?? 0) + 1);
    expect([...byWeek.keys()].sort()).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    expect(byWeek.get('2026-11-16')).toBe(30);
    expect(byWeek.get('2026-11-23')).toBeLessThan(30);
    expect(new Set(ratings.map((r) => r.rating)).size).toBeGreaterThanOrEqual(4);
  });

  it('seeds Phase 2 sprint marks: Sprints 1–3 for 26-08-03, all four for the graduated 26-05-02', () => {
    const wednesday = createSeedDb(new Date(2026, 10, 25, 10, 0, 0));
    const marks = selectAll(wednesday.sprintMarks);
    const byCode = (code: string) => {
      const c = selectAll(wednesday.cohorts).find((x) => x.code === code)!;
      return marks.filter((m) => m.cohortId === c.id);
    };
    expect(new Set(byCode('26-08-03').map((m) => m.sprintNumber))).toEqual(new Set([1, 2, 3]));
    expect(new Set(byCode('26-05-02').map((m) => m.sprintNumber))).toEqual(new Set([1, 2, 3, 4]));
    expect(byCode('26-11-04')).toHaveLength(0);
    expect(marks.every((m) => m.score >= 0 && m.score <= 100 && m.projectName && m.deliverableSummary)).toBe(true);
    expect(new Set(marks.map((m) => m.id)).size).toBe(marks.length);
  });

  it('stays well within localStorage limits', () => {
    expect(JSON.stringify(db).length).toBeLessThan(1_500_000);
  });
});
