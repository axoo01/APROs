import {
  addDays,
  attendanceId,
  defaultCohortDisplayName,
  buildCohortCode,
  isWithin,
  monthOf,
  tableFrom,
  toIsoDate,
  workingDaysBetween,
  yearOf,
  type Apprentice,
  type ApprenticeStatus,
  type AttendanceReason,
  type AttendanceRecord,
  type AttendanceStatus,
  type Cohort,
  type ColorTag,
  type Id,
  type IsoDate,
  type Role,
  type Specialization,
  type User,
} from '../../domain';
import { DB_SCHEMA_VERSION, type DbSchema } from '../local-db/db-schema.model';
import { FIRST_NAMES, LAST_NAMES } from './names.const';
import { Prng } from './prng.util';

const STRUCTURE_SEED = 0xa9_2026;
const HISTORY_SEED = 0x11_0426;
const PATTERN_SEED = 0x57_4eaf;

/** The live demo cohort's history covers (at most) the last 4 weeks of working days before today. */
export const LIVE_HISTORY_WORKING_DAYS = 20;

/** Coach whose group gets the planted patterns, so "Mine" shows them when demoing as the coach persona. */
const PATTERN_COACH_EMAIL = 'axcel@apros.demo';

/** Planted, deterministic patterns so streak pills and follow-up insights are visible right after a reset. */
/** Consecutive `A` days ending yesterday — coach persona's group first, then others. */
const PLANTED_ABSENCE_STREAKS = { mine: [6, 2], others: [8, 3, 5, 2] } as const;
/** Consecutive `L` days ending yesterday (so this week's Mon/Tue are late on a Wednesday). */
const PLANTED_LATE_RUNS = { mine: [3, 2], others: [3, 2, 3] } as const;

const NOTES: Readonly<Partial<Record<AttendanceReason, readonly string[]>>> = {
  SICK: ['Called in with a fever', 'Clinic visit — sick note to follow', 'Flu, resting at home'],
  APPOINTMENT: ['Embassy visa appointment', 'Dental appointment', 'Bank appointment, back after lunch'],
  FAMILY: ['Family emergency', 'Travelled for a family funeral'],
  TRANSPORT: ['Trotro breakdown on the way', 'Ride cancelled last minute'],
  TRAFFIC: ['Heavy traffic at Kwame Nkrumah Circle', 'Accident on the motorway'],
};

/** Ghana public holidays + programme year-end break (2026–27). Weekends are implicit. */
const NON_WORKING_DAYS: readonly IsoDate[] = [
  '2026-01-01', '2026-01-07', '2026-03-06', '2026-04-03', '2026-04-06', '2026-05-01',
  '2026-07-01', '2026-08-04', '2026-09-21', '2026-12-04', '2026-12-24', '2026-12-25',
  '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-07',
  '2027-03-26', '2027-03-29',
];

interface UserSeed {
  readonly fullName: string;
  readonly email: string;
  readonly role: Role;
  readonly title: string;
}

const USERS: readonly UserSeed[] = [
  { fullName: 'Abena Owusu-Ansah', email: 'abena.owusu-ansah@apros.demo', role: 'ADMIN', title: 'Head of Coaches' },
  { fullName: 'Daniel Nkansah', email: 'daniel.nkansah@apros.demo', role: 'ADMIN', title: 'Cohort Lead' },
  { fullName: 'Jamillah', email: 'jamillah@apros.demo', role: 'COACH', title: 'Coach' },
  { fullName: 'Favor', email: 'favor@apros.demo', role: 'COACH', title: 'Coach' },
  { fullName: 'Nelly', email: 'nelly@apros.demo', role: 'COACH', title: 'Coach' },
  { fullName: 'Peggy', email: 'peggy@apros.demo', role: 'COACH', title: 'Coach' },
  { fullName: 'Axcel', email: 'axcel@apros.demo', role: 'COACH', title: 'Coach' },
];

/** The live cohort's real roster: apprentice → coach (by the coach's seeded fullName). */
const LIVE_ROSTER: readonly { readonly name: string; readonly coach: string }[] = [
  { name: 'Aklile Seyoum Mamo', coach: 'Jamillah' },
  { name: 'Aline Niyonizera', coach: 'Jamillah' },
  { name: 'Dukundane Furaha Yves Derick', coach: 'Jamillah' },
  { name: 'Erick Kanja', coach: 'Jamillah' },
  { name: 'Innocent Bugingo', coach: 'Jamillah' },
  { name: 'Iradukunda Toussaint', coach: 'Jamillah' },
  { name: 'Irimaso Maurice', coach: 'Favor' },
  { name: 'Mugabo Vedaste', coach: 'Favor' },
  { name: 'Taylor Chongo', coach: 'Favor' },
  { name: 'Victoire Ansima Ikuyo', coach: 'Favor' },
  { name: 'Christine Umutoni', coach: 'Favor' },
  { name: 'David Bonfils Kamanda', coach: 'Favor' },
  { name: 'Fabrice Sheja', coach: 'Nelly' },
  { name: 'Levy Imanzi', coach: 'Nelly' },
  { name: 'Molo Munyansanga', coach: 'Nelly' },
  { name: 'Olivier Kwizera', coach: 'Nelly' },
  { name: 'Prince Dushimimana', coach: 'Nelly' },
  { name: 'Umutoni Justine', coach: 'Nelly' },
  { name: 'Amanuel Kebede', coach: 'Peggy' },
  { name: 'Benjamin Ssempala', coach: 'Peggy' },
  { name: 'Clement Nsengiyumva', coach: 'Peggy' },
  { name: 'Kabera Clapton Gahenda', coach: 'Peggy' },
  { name: 'Annick Ujeneza', coach: 'Peggy' },
  { name: 'Kevine Uwisanga', coach: 'Peggy' },
  { name: 'Emery Bashige', coach: 'Axcel' },
  { name: 'Igizeneza Serge Benit', coach: 'Axcel' },
  { name: 'Jesephus Mupanda', coach: 'Axcel' },
  { name: 'Mugwaneza Manzi Audace', coach: 'Axcel' },
  { name: 'Atete Shina Mpeta', coach: 'Axcel' },
  { name: 'Nancy Kamikazi', coach: 'Axcel' },
];

/** Specializations are spread evenly across the live roster (not given in the source list). */
const LIVE_SPEC_CYCLE: readonly string[] = ['FE', 'BE', 'DE', 'DO', 'QA', 'UX'];

const SPECIALIZATIONS: readonly { name: string; code: string; colorTag: ColorTag }[] = [
  { name: 'Frontend Engineering', code: 'FE', colorTag: 'light-blue' },
  { name: 'Backend Engineering (Java)', code: 'BE', colorTag: 'indigo' },
  { name: 'Data Engineering', code: 'DE', colorTag: 'teal' },
  { name: 'Cloud & DevOps', code: 'DO', colorTag: 'purple' },
  { name: 'Quality Assurance', code: 'QA', colorTag: 'green' },
  { name: 'Product Design (UI/UX)', code: 'UX', colorTag: 'pink' },
];

interface CohortSeed {
  readonly sequenceNumber: number;
  readonly phase1StartDate: IsoDate;
  readonly phase1EndDate: IsoDate;
  readonly phase2StartDate: IsoDate;
  readonly phase2EndDate: IsoDate;
  /** Apprentices per specialization code. */
  readonly roster: Readonly<Record<string, number>>;
  readonly graduated: boolean;
  readonly withdrawn: number;
  readonly unassigned: number;
  readonly withHistory: boolean;
  /** The cohort demoed live: real roster, recent-window history + planted patterns. */
  readonly live?: boolean;
}

const COHORTS: readonly CohortSeed[] = [
  {
    sequenceNumber: 1, phase1StartDate: '2026-02-02', phase1EndDate: '2026-04-24',
    phase2StartDate: '2026-05-04', phase2EndDate: '2026-08-21',
    roster: { FE: 6, BE: 6, DE: 4, QA: 3, UX: 3 }, graduated: true, withdrawn: 0, unassigned: 0, withHistory: false,
  },
  {
    sequenceNumber: 2, phase1StartDate: '2026-05-04', phase1EndDate: '2026-07-24',
    phase2StartDate: '2026-08-03', phase2EndDate: '2026-11-20',
    roster: { FE: 6, BE: 6, DE: 4, DO: 4, QA: 4 }, graduated: true, withdrawn: 0, unassigned: 0, withHistory: false,
  },
  {
    sequenceNumber: 3, phase1StartDate: '2026-08-03', phase1EndDate: '2026-10-23',
    phase2StartDate: '2026-11-02', phase2EndDate: '2027-02-19',
    roster: { FE: 7, BE: 7, DE: 5, DO: 4, QA: 4, UX: 3 }, graduated: false, withdrawn: 1, unassigned: 0, withHistory: true,
  },
  {
    sequenceNumber: 4, phase1StartDate: '2026-11-02', phase1EndDate: '2027-01-29',
    phase2StartDate: '2027-02-08', phase2EndDate: '2027-05-28',
    roster: {}, graduated: false, withdrawn: 0, unassigned: 0, withHistory: true,
    live: true,
  },
];

type Profile = 'star' | 'steady' | 'late-riser' | 'at-risk';

const PROFILE_WEIGHTS: Readonly<Record<Profile, number>> = { star: 8, steady: 64, 'late-riser': 16, 'at-risk': 12 };

const STATUS_WEIGHTS: Readonly<Record<Profile, Readonly<Record<AttendanceStatus, number>>>> = {
  star: { P: 96, L: 2, A: 0, E: 2 },
  steady: { P: 88, L: 6, A: 2, E: 4 },
  'late-riser': { P: 60, L: 32, A: 3, E: 5 },
  'at-risk': { P: 62, L: 13, A: 18, E: 7 },
};

const at = (date: IsoDate, hour: number, minute: number): string =>
  new Date(yearOf(date), monthOf(date) - 1, Number(date.slice(8, 10)), hour, minute).toISOString();

/**
 * Builds the full demo dataset. Structure (ids, people, cohorts) is fixed; attendance history
 * fills every working day from Phase 1 start up to *yesterday*, so "today" always starts fresh
 * for the Sweep workflow.
 */
export function createSeedDb(now: Date): DbSchema {
  const rng = new Prng(STRUCTURE_SEED);
  const today = toIsoDate(now);
  const nowIso = now.toISOString();

  const users: User[] = USERS.map((u) => ({
    id: rng.uuid(),
    ...u,
    avatarUrl: null,
    isActive: true,
    createdAt: '2025-12-01T09:00:00.000Z',
    updatedAt: '2025-12-01T09:00:00.000Z',
  }));
  const coaches = users.filter((u) => u.role === 'COACH');

  const specializations: Specialization[] = SPECIALIZATIONS.map((s) => ({
    id: rng.uuid(),
    ...s,
    isActive: true,
    createdAt: '2025-12-01T09:00:00.000Z',
    updatedAt: '2025-12-01T09:00:00.000Z',
  }));
  const specByCode = new Map(specializations.map((s) => [s.code, s]));

  const cohorts: Cohort[] = [];
  const apprentices: Apprentice[] = [];
  const profiles = new Map<Id, Profile>();
  const withdrawnIds = new Set<Id>();
  const usedNames = new Set<string>();
  const usedEmails = new Set<string>();

  for (const c of COHORTS) {
    const code = buildCohortCode(c.phase1StartDate, c.sequenceNumber);
    const createdAt = at(addDays(c.phase1StartDate, -21), 9, 0);
    const cohort: Cohort = {
      id: rng.uuid(),
      code,
      year: yearOf(c.phase1StartDate),
      month: monthOf(c.phase1StartDate),
      sequenceNumber: c.sequenceNumber,
      displayName: defaultCohortDisplayName(code),
      phase1StartDate: c.phase1StartDate,
      phase1EndDate: c.phase1EndDate,
      phase2StartDate: c.phase2StartDate,
      phase2EndDate: c.phase2EndDate,
      nonWorkingDays: NON_WORKING_DAYS.filter((d) => isWithin(d, c.phase1StartDate, c.phase2EndDate)),
      isArchived: false,
      createdAt,
      updatedAt: createdAt,
    };
    cohorts.push(cohort);

    if (c.live) {
      const coachByName = new Map(coaches.map((u) => [u.fullName, u.id]));
      LIVE_ROSTER.forEach((entry, i) => {
        const [first = entry.name, ...rest] = entry.name.split(' ');
        const spec = specByCode.get(LIVE_SPEC_CYCLE[i % LIVE_SPEC_CYCLE.length]!);
        const coachId = coachByName.get(entry.coach);
        if (!spec || !coachId) throw new Error(`Bad live roster entry ${entry.name}`);
        usedNames.add(entry.name);
        const slug = entry.name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.');
        let email = `${slug}@apprentice.apros.demo`;
        for (let n = 2; usedEmails.has(email); n++) email = `${slug}${n}@apprentice.apros.demo`;
        usedEmails.add(email);
        const apprentice: Apprentice = {
          id: rng.uuid(),
          firstName: first,
          lastName: rest.join(' '),
          preferredName: null,
          email,
          avatarUrl: null,
          cohortId: cohort.id,
          specializationId: spec.id,
          coachId,
          status: 'ACTIVE',
          createdAt,
          updatedAt: createdAt,
        };
        apprentices.push(apprentice);
        profiles.set(apprentice.id, rng.weighted(PROFILE_WEIGHTS));
      });
      continue;
    }

    const members: Apprentice[] = [];
    for (const [specCode, count] of Object.entries(c.roster)) {
      const spec = specByCode.get(specCode);
      if (!spec) throw new Error(`Unknown specialization ${specCode}`);
      for (let i = 0; i < count; i++) {
        let first: string;
        let last: string;
        do {
          first = rng.pick(FIRST_NAMES);
          last = rng.pick(LAST_NAMES);
        } while (usedNames.has(`${first} ${last}`));
        usedNames.add(`${first} ${last}`);

        const slug = `${first}.${last}`.toLowerCase().replace(/[^a-z.-]/g, '');
        let email = `${slug}@apprentice.apros.demo`;
        for (let n = 2; usedEmails.has(email); n++) email = `${slug}${n}@apprentice.apros.demo`;
        usedEmails.add(email);

        const status: ApprenticeStatus = c.graduated ? 'GRADUATED' : 'ACTIVE';
        const apprentice: Apprentice = {
          id: rng.uuid(),
          firstName: first,
          lastName: last,
          preferredName: rng.next() < 0.08 ? first.slice(0, 3) : null,
          email,
          avatarUrl: null,
          cohortId: cohort.id,
          specializationId: spec.id,
          coachId: null,
          status,
          createdAt,
          updatedAt: createdAt,
        };
        members.push(apprentice);
        profiles.set(apprentice.id, rng.weighted(PROFILE_WEIGHTS));
      }
    }

    // Coach assignment: balanced round-robin over a shuffled roster; last N stay Unassigned.
    const order = rng.shuffle(members.map((_, i) => i));
    const unassigned = new Set(order.slice(order.length - c.unassigned));
    const withdrawn = new Set(order.slice(0, c.withdrawn));
    let cursor = rng.int(0, coaches.length - 1);
    members.forEach((m, i) => {
      const coachId = unassigned.has(i) ? null : coaches[cursor++ % coaches.length]!.id;
      const status: ApprenticeStatus = withdrawn.has(i) ? 'WITHDRAWN' : m.status;
      if (status === 'WITHDRAWN') withdrawnIds.add(m.id);
      apprentices.push({ ...m, coachId, status });
    });
  }

  const attendance = buildHistory(cohorts, COHORTS, apprentices, profiles, withdrawnIds, coaches, today);

  return {
    schemaVersion: DB_SCHEMA_VERSION,
    seededAt: nowIso,
    users: tableFrom(users),
    specializations: tableFrom(specializations),
    cohorts: tableFrom(cohorts),
    apprentices: tableFrom(apprentices),
    attendance: tableFrom(attendance),
  };
}

function buildHistory(
  cohorts: readonly Cohort[],
  seeds: readonly CohortSeed[],
  apprentices: readonly Apprentice[],
  profiles: ReadonlyMap<Id, Profile>,
  withdrawnIds: ReadonlySet<Id>,
  coaches: readonly User[],
  today: IsoDate,
): AttendanceRecord[] {
  const rng = new Prng(HISTORY_SEED);
  const out: AttendanceRecord[] = [];

  cohorts.forEach((cohort, idx) => {
    const seed = seeds[idx];
    if (!seed?.withHistory) return;
    const end = [cohort.phase1EndDate, addDays(today, -1)].sort()[0]!;
    const allDays = workingDaysBetween(cohort, cohort.phase1StartDate, end);
    const days = seed.live ? allDays.slice(-LIVE_HISTORY_WORKING_DAYS) : allDays;
    if (days.length === 0) return;
    const members = apprentices.filter((a) => a.cohortId === cohort.id);
    const cohortRecords = new Map<Id, AttendanceRecord>();

    for (const a of members) {
      const profile = profiles.get(a.id) ?? 'steady';
      // Withdrawn apprentices only have records until they left (~40% into the phase).
      const lastDay = withdrawnIds.has(a.id) ? Math.max(1, Math.floor(days.length * 0.4)) : days.length;

      for (const date of days.slice(0, lastDay)) {
        const status = rng.weighted(STATUS_WEIGHTS[profile]);
        const reason = pickReason(rng, status);
        const recorder = a.coachId && rng.next() < 0.8 ? a.coachId : rng.pick(coaches).id;
        const recordedAt =
          status === 'L' ? at(date, 9, rng.int(5, 50)) : at(date, 8, rng.int(30, 59));
        const note = reason && status !== 'L' && rng.next() < 0.45 ? pickNote(rng, reason) : null;
        cohortRecords.set(attendanceId(a.id, date), {
          id: attendanceId(a.id, date),
          apprenticeId: a.id,
          cohortId: cohort.id,
          date,
          status,
          reason,
          note,
          recordedBy: recorder,
          recordedAt,
          createdAt: recordedAt,
          updatedAt: recordedAt,
        });
      }
    }

    if (seed.live) {
      const coach = coaches.find((c) => c.email === PATTERN_COACH_EMAIL) ?? coaches[0];
      const active = members.filter((m) => !withdrawnIds.has(m.id));
      plantPatterns(cohortRecords, active, days, coach?.id ?? null);
    }
    out.push(...cohortRecords.values());
  });
  return out;
}

/**
 * Overwrites history for a few apprentices (coach persona's group first) with recognisable patterns:
 * absence streaks and runs of lates, both ending yesterday.
 */
function plantPatterns(
  records: Map<Id, AttendanceRecord>,
  active: readonly Apprentice[],
  days: readonly IsoDate[],
  coachId: Id | null,
): void {
  const rng = new Prng(PATTERN_SEED);
  const mine = active.filter((a) => a.coachId === coachId);
  const others = active.filter((a) => a.coachId !== coachId && a.coachId !== null);

  const set = (a: Apprentice, date: IsoDate, status: AttendanceStatus, reason: AttendanceReason | null, note: string | null) => {
    const id = attendanceId(a.id, date);
    const base = records.get(id);
    if (!base) return;
    const recordedAt = status === 'L' ? at(date, 9, rng.int(5, 45)) : at(date, 10, rng.int(0, 30));
    records.set(id, { ...base, status, reason, note, recordedAt, createdAt: recordedAt, updatedAt: recordedAt });
  };

  /** Overwrites the last `length` working days with `status`, plus a clean `P` edge before the run. */
  const run = (a: Apprentice | undefined, length: number, status: 'A' | 'L', first: { reason: AttendanceReason; note: string } | null) => {
    const n = Math.min(length, days.length - 1);
    if (!a || n < 1) return;
    days.slice(-n).forEach((d, j) => {
      if (status === 'L') set(a, d, 'L', rng.weighted({ TRAFFIC: 3, TRANSPORT: 2 }), null);
      else set(a, d, 'A', j === 0 && first ? first.reason : null, j === 0 && first ? first.note : null);
    });
    const edge = days[days.length - n - 1];
    if (edge) set(a, edge, 'P', null, null);
  };

  // Absence streaks take the first apprentices of each pool, late runs the next ones — never overlapping.
  PLANTED_ABSENCE_STREAKS.mine.forEach((n, i) =>
    run(mine[i], n, 'A', i === 0 ? { reason: 'SICK', note: 'Called in sick — no update since' } : null),
  );
  PLANTED_ABSENCE_STREAKS.others.forEach((n, i) => run(others[i], n, 'A', null));
  const mineOffset = PLANTED_ABSENCE_STREAKS.mine.length;
  const othersOffset = PLANTED_ABSENCE_STREAKS.others.length;
  PLANTED_LATE_RUNS.mine.forEach((n, i) => run(mine[mineOffset + i], n, 'L', null));
  PLANTED_LATE_RUNS.others.forEach((n, i) => run(others[othersOffset + i], n, 'L', null));
}

function pickNote(rng: Prng, reason: AttendanceReason): string | null {
  const options = NOTES[reason];
  return options?.length ? rng.pick(options) : null;
}

function pickReason(rng: Prng, status: AttendanceStatus): AttendanceReason | null {
  switch (status) {
    case 'P':
      return null;
    case 'L':
      return rng.next() < 0.7 ? rng.weighted({ TRAFFIC: 6, TRANSPORT: 3, OTHER: 1 }) : null;
    case 'A':
      return rng.next() < 0.4 ? rng.weighted({ SICK: 3, FAMILY: 1, OTHER: 1 }) : null;
    case 'E':
      return rng.weighted({ SICK: 4, FAMILY: 2, APPOINTMENT: 3, TRANSPORT: 1 });
  }
}
