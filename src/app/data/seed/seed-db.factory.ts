import {
  addDays,
  BEHAVIOR_DEFINITIONS,
  EOD_PRESETS,
  attendanceId,
  behaviorId,
  cohortWeeks,
  eodId,
  onPaceRate,
  summarizeAttendance,
  sprintBand,
  sprintMarkId,
  type SprintBand,
  type SprintMark,
  type SprintNumber,
  tallyEod,
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
  type EodPacingRecord,
  type EodStatus,
  type EodTag,
  type BehaviorRating,
  type WeeklyBehaviorRecord,
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
const EOD_SEED = 0xe0_d2026;
const BEHAVIOR_SEED = 0xbe_4a71;
const SPRINT_SEED = 0x5b_2026;

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
  { fullName: 'Bob Karemera', email: 'bob.karemera@apros.demo', role: 'ADMIN', title: 'Head of Coaches' },
  { fullName: 'Daniel Nkansah', email: 'daniel.nkansah@apros.demo', role: 'ADMIN', title: 'Cohort Lead' },
  { fullName: 'Jamillah', email: 'jamillah@apros.demo', role: 'COACH', title: 'Coach' },
  { fullName: 'Favor', email: 'favor@apros.demo', role: 'COACH', title: 'Coach' },
  { fullName: 'Nelly', email: 'nelly@apros.demo', role: 'COACH', title: 'Coach' },
  { fullName: 'Peggy', email: 'peggy@apros.demo', role: 'COACH', title: 'Coach' },
  { fullName: 'Axcel', email: 'axcel@apros.demo', role: 'COACH', title: 'Coach' },
];

/** The live cohort's real roster: apprentice → coach (seeded fullName) and specialization code. */
const LIVE_ROSTER: readonly { readonly name: string; readonly coach: string; readonly spec: string }[] = [
  { name: 'Aklile Seyoum Mamo', coach: 'Jamillah', spec: 'PB' },
  { name: 'Aline Niyonizera', coach: 'Jamillah', spec: 'PB' },
  { name: 'Dukundane Furaha Yves Derick', coach: 'Jamillah', spec: 'PB' },
  { name: 'Erick Kanja', coach: 'Jamillah', spec: 'PB' },
  { name: 'Innocent Bugingo', coach: 'Jamillah', spec: 'PB' },
  { name: 'Iradukunda Toussaint', coach: 'Jamillah', spec: 'PB' },
  { name: 'Irimaso Maurice', coach: 'Favor', spec: 'PB' },
  { name: 'Mugabo Vedaste', coach: 'Favor', spec: 'PB' },
  { name: 'Taylor Chongo', coach: 'Favor', spec: 'PB' },
  { name: 'Victoire Ansima Ikuyo', coach: 'Favor', spec: 'PB' },
  { name: 'Christine Umutoni', coach: 'Favor', spec: 'DE' },
  { name: 'David Bonfils Kamanda', coach: 'Favor', spec: 'DE' },
  { name: 'Fabrice Sheja', coach: 'Nelly', spec: 'DE' },
  { name: 'Levy Imanzi', coach: 'Nelly', spec: 'DE' },
  { name: 'Molo Munyansanga', coach: 'Nelly', spec: 'DE' },
  { name: 'Olivier Kwizera', coach: 'Nelly', spec: 'DE' },
  { name: 'Prince Dushimimana', coach: 'Nelly', spec: 'DE' },
  { name: 'Umutoni Justine', coach: 'Nelly', spec: 'DE' },
  { name: 'Amanuel Kebede', coach: 'Peggy', spec: 'DO' },
  { name: 'Benjamin Ssempala', coach: 'Peggy', spec: 'DO' },
  { name: 'Clement Nsengiyumva', coach: 'Peggy', spec: 'DO' },
  { name: 'Kabera Clapton Gahenda', coach: 'Peggy', spec: 'DO' },
  { name: 'Annick Ujeneza', coach: 'Peggy', spec: 'QA' },
  { name: 'Kevine Uwisanga', coach: 'Peggy', spec: 'QA' },
  { name: 'Emery Bashige', coach: 'Axcel', spec: 'JB' },
  { name: 'Igizeneza Serge Benit', coach: 'Axcel', spec: 'JB' },
  { name: 'Jesephus Mupanda', coach: 'Axcel', spec: 'JB' },
  { name: 'Mugwaneza Manzi Audace', coach: 'Axcel', spec: 'JB' },
  { name: 'Atete Shina Mpeta', coach: 'Axcel', spec: 'FS' },
  { name: 'Nancy Kamikazi', coach: 'Axcel', spec: 'FS' },
];


const SPECIALIZATIONS: readonly { name: string; code: string; colorTag: ColorTag }[] = [
  { name: 'Fullstack JS', code: 'FS', colorTag: 'light-blue' },
  { name: 'QA', code: 'QA', colorTag: 'green' },
  { name: 'Java BE', code: 'JB', colorTag: 'indigo' },
  { name: 'DevOps', code: 'DO', colorTag: 'purple' },
  { name: 'Python BE', code: 'PB', colorTag: 'yellow' },
  { name: 'DE', code: 'DE', colorTag: 'teal' },
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
  readonly withHistory: boolean;
  /** The cohort demoed live: real roster, recent-window history + planted patterns. */
  readonly live?: boolean;
  /** Phase 2 sprint marks to seed: how many sprints are done and their cadence (days). */
  readonly sprints?: { readonly count: number; readonly cadenceDays: number };
}

const COHORTS: readonly CohortSeed[] = [
  {
    sequenceNumber: 1, phase1StartDate: '2026-02-02', phase1EndDate: '2026-04-24',
    phase2StartDate: '2026-05-04', phase2EndDate: '2026-08-21',
    roster: { FS: 6, JB: 6, DE: 4, QA: 3, PB: 3 }, graduated: true, withdrawn: 0, withHistory: false,
  },
  {
    sequenceNumber: 2, phase1StartDate: '2026-05-04', phase1EndDate: '2026-07-24',
    phase2StartDate: '2026-08-03', phase2EndDate: '2026-11-20',
    roster: { FS: 6, JB: 6, DE: 4, DO: 4, QA: 4 }, graduated: true, withdrawn: 0, withHistory: false,
    sprints: { count: 4, cadenceDays: 28 },
  },
  {
    sequenceNumber: 3, phase1StartDate: '2026-08-03', phase1EndDate: '2026-10-23',
    phase2StartDate: '2026-11-02', phase2EndDate: '2027-02-19',
    roster: { FS: 7, JB: 7, DE: 5, DO: 4, QA: 4, PB: 3 }, graduated: false, withdrawn: 1, withHistory: true,
    sprints: { count: 3, cadenceDays: 7 },
  },
  {
    sequenceNumber: 4, phase1StartDate: '2026-11-02', phase1EndDate: '2027-01-29',
    phase2StartDate: '2027-02-08', phase2EndDate: '2027-05-28',
    roster: {}, graduated: false, withdrawn: 0, withHistory: true,
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
      LIVE_ROSTER.forEach((entry) => {
        const [first = entry.name, ...rest] = entry.name.split(' ');
        const spec = specByCode.get(entry.spec);
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

    // Coach assignment: balanced round-robin over a shuffled roster — every apprentice has a coach.
    const order = rng.shuffle(members.map((_, i) => i));
    const withdrawn = new Set(order.slice(0, c.withdrawn));
    let cursor = rng.int(0, coaches.length - 1);
    members.forEach((m, i) => {
      const coachId = coaches[cursor++ % coaches.length]!.id;
      const status: ApprenticeStatus = withdrawn.has(i) ? 'WITHDRAWN' : m.status;
      if (status === 'WITHDRAWN') withdrawnIds.add(m.id);
      apprentices.push({ ...m, coachId, status });
    });
  }

  const attendance = buildHistory(cohorts, COHORTS, apprentices, profiles, withdrawnIds, coaches, today);
  const { records: eodPacing, behindIds } = buildEodHistory(cohorts, COHORTS, apprentices, profiles, attendance);
  const weeklyBehavior = buildBehaviorHistory(cohorts, COHORTS, apprentices, attendance, eodPacing, behindIds, today);
  const admin = users.find((u) => u.role === 'ADMIN')!;
  const sprintMarks = buildSprintMarks(cohorts, COHORTS, apprentices, profiles, specializations, admin.id, today);

  return {
    schemaVersion: DB_SCHEMA_VERSION,
    seededAt: nowIso,
    users: tableFrom(users),
    specializations: tableFrom(specializations),
    cohorts: tableFrom(cohorts),
    apprentices: tableFrom(apprentices),
    attendance: tableFrom(attendance),
    eodPacing: tableFrom(eodPacing),
    weeklyBehavior: tableFrom(weeklyBehavior),
    sprintMarks: tableFrom(sprintMarks),
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

// ── EOD pacing ─────────────────────────────────────────────────────────────────

const EOD_WEIGHTS: Readonly<Record<Profile, Readonly<Record<EodStatus, number>>>> = {
  star: { ON_PACE: 88, NEEDS_SUPPORT: 9, BLOCKED: 3 },
  steady: { ON_PACE: 74, NEEDS_SUPPORT: 18, BLOCKED: 8 },
  'late-riser': { ON_PACE: 64, NEEDS_SUPPORT: 24, BLOCKED: 12 },
  'at-risk': { ON_PACE: 48, NEEDS_SUPPORT: 30, BLOCKED: 22 },
};

/** Extra hand-written specifics, used instead of the preset sentence on some days. */
const EOD_CUSTOM_NOTES: Readonly<Partial<Record<EodTag, readonly string[]>>> = {
  GREAT_PROGRESS: ['Merged first PR of the sprint', 'Great demo at stand-up'],
  AHEAD_OF_TIME: ['Finished the API endpoints a day early'],
  CONCEPTS: ['Struggling with async/await', 'Needs a walkthrough on SQL joins'],
  MISSED_TARGET: ['Auth flow slipped to tomorrow'],
  ENVIRONMENT: ['Power outage and no internet for half the day', 'Still waiting on cloud console access'],
  TECHNICAL: ['CORS errors on the auth integration', 'Flaky test blocking the pipeline'],
  TIME_MGMT: ['Underestimated the ticket scope'],
};

/** Behind streaks (consecutive Needs Support / Blocked days ending yesterday) planted in the live cohort. */
const PLANTED_BEHIND_STREAKS: readonly number[] = [3, 2, 4];
/** Planted Blocked days share this tag → a "systemic blocker" callout on the dashboard. */
const PLANTED_BLOCKER_TAG: EodTag = 'ENVIRONMENT';
/** Planted streaks go to apprentices with high attendance, so they read as "Silent Drift" rather than absence. */
const DRIFT_MIN_ATTENDANCE = 0.9;

/**
 * EOD history for the live cohort, only on days the apprentice was present (P/L) — absent days have no EOD.
 * Profile-weighted statuses, positive notes on some On Pace days, blocker tags/notes otherwise,
 * plus a few planted "behind" streaks ending yesterday.
 */
function buildEodHistory(
  cohorts: readonly Cohort[],
  seeds: readonly CohortSeed[],
  apprentices: readonly Apprentice[],
  profiles: ReadonlyMap<Id, Profile>,
  attendance: readonly AttendanceRecord[],
): { records: EodPacingRecord[]; behindIds: Id[] } {
  const rng = new Prng(EOD_SEED);
  const liveIdx = seeds.findIndex((c) => c.live);
  const cohort = cohorts[liveIdx];
  if (!cohort) return { records: [], behindIds: [] };

  const present = attendance.filter((r) => r.cohortId === cohort.id && (r.status === 'P' || r.status === 'L'));
  const presentKeys = new Set(present.map((r) => r.id));
  const coachOf = new Map(apprentices.map((a) => [a.id, a.coachId]));
  const records = new Map<Id, EodPacingRecord>();

  const make = (apprenticeId: Id, date: IsoDate, status: EodStatus, recorder: Id, forcedTag?: EodTag): EodPacingRecord => {
    let tag: EodTag | null = null;
    let note: string | null = null;
    // On Pace days get a highlight ~30% of the time; behind days almost always carry a blocker.
    if (status !== 'ON_PACE' || rng.next() < 0.3) {
      const preset = EOD_PRESETS[status].find((p) => p.tag === forcedTag) ?? rng.pick(EOD_PRESETS[status]);
      tag = preset.tag;
      const custom = EOD_CUSTOM_NOTES[preset.tag];
      note = custom?.length && rng.next() < 0.35 ? rng.pick(custom) : rng.next() < 0.85 ? preset.note : null;
    }
    const recordedAt = at(date, 17, rng.int(10, 55));
    return {
      id: eodId(apprenticeId, date),
      apprenticeId,
      cohortId: cohort.id,
      date,
      status,
      tag,
      note,
      recordedBy: recorder,
      recordedAt,
      createdAt: recordedAt,
      updatedAt: recordedAt,
    };
  };

  for (const r of present) {
    const profile = profiles.get(r.apprenticeId) ?? 'steady';
    const recorder = coachOf.get(r.apprenticeId) ?? r.recordedBy;
    records.set(eodId(r.apprenticeId, r.date), make(r.apprenticeId, r.date, rng.weighted(EOD_WEIGHTS[profile]), recorder));
  }

  // Planted streaks: candidates present on every streak day plus the edge day before it.
  const days = [...new Set(present.map((r) => r.date))].sort();
  const members = apprentices.filter((a) => a.cohortId === cohort.id && a.status === 'ACTIVE');
  const used = new Set<Id>();
  const behindIds: Id[] = [];
  const attendanceOf = (id: Id) => summarizeAttendance(attendance.filter((r) => r.apprenticeId === id)).attendanceRate;
  for (const length of PLANTED_BEHIND_STREAKS) {
    const window = days.slice(-(length + 1));
    const eligible = members.filter(
      (a) => !used.has(a.id) && window.length === length + 1 && window.every((d) => presentKeys.has(attendanceId(a.id, d))),
    );
    const candidate = eligible.find((a) => attendanceOf(a.id) >= DRIFT_MIN_ATTENDANCE) ?? eligible[0];
    if (!candidate) continue;
    used.add(candidate.id);
    behindIds.push(candidate.id);
    const recorder = candidate.coachId ?? coachOf.get(candidate.id) ?? present[0]!.recordedBy;
    window.forEach((d, i) => {
      const status: EodStatus = i === 0 ? 'ON_PACE' : i % 2 === 0 ? 'BLOCKED' : 'NEEDS_SUPPORT';
      const tag = status === 'BLOCKED' ? PLANTED_BLOCKER_TAG : undefined;
      records.set(eodId(candidate.id, d), make(candidate.id, d, status, recorder, tag));
    });
  }
  return { records: [...records.values()], behindIds };
}

// ── Weekly behavior ───────────────────────────────────────────────────────────

/** Weeks rated in the demo: the last few *completed* cohort weeks. The current week is left unrated for the live demo. */
const BEHAVIOR_HISTORY_WEEKS = 3;

const BEHAVIOR_CUSTOM_NOTES: Readonly<Record<BehaviorRating, readonly string[]>> = {
  '+H': ['Led the sprint demo and mentored two peers.', 'Owned the release checklist end to end.'],
  '+M': ['Reliable all week; good stand-up updates.'],
  '+L': ['On track; encourage more questions in reviews.'],
  '-H': ['Two late mornings — quick check-in booked.'],
  '-M': ['Skipped two EOD updates; agreed a daily reminder.'],
  '-L': ['Unreachable for most of the week — escalated to the cohort lead.'],
};

/** Last-week ratings forced on the planted behind-streak apprentices (same order) — EOD + behavior dip together. */
const PLANTED_DRIFT_RATINGS: readonly BehaviorRating[] = ['-M', '-M', '-H'];

/** Maps a week's attendance + EOD signal (0–1) to the 6-tier scale. */
function ratingFor(score: number): BehaviorRating {
  if (score >= 0.95) return '+H';
  if (score >= 0.87) return '+M';
  if (score >= 0.78) return '+L';
  if (score >= 0.68) return '-H';
  if (score >= 0.52) return '-M';
  return '-L';
}

/**
 * Weekly ratings for the live cohort, derived from that week's attendance and EOD (with a little noise):
 * the last {@link BEHAVIOR_HISTORY_WEEKS} completed weeks fully rated; the current week stays unrated.
 */
function buildBehaviorHistory(
  cohorts: readonly Cohort[],
  seeds: readonly CohortSeed[],
  apprentices: readonly Apprentice[],
  attendance: readonly AttendanceRecord[],
  eod: readonly EodPacingRecord[],
  driftIds: readonly Id[],
  today: IsoDate,
): WeeklyBehaviorRecord[] {
  const rng = new Prng(BEHAVIOR_SEED);
  const cohort = cohorts[seeds.findIndex((c) => c.live)];
  if (!cohort) return [];
  const weeks = cohortWeeks(cohort, today);
  const rated = weeks.slice(0, -1).slice(-BEHAVIOR_HISTORY_WEEKS);
  const lastCompleted = rated.at(-1);
  const members = apprentices.filter((a) => a.cohortId === cohort.id && a.status === 'ACTIVE');
  const out = new Map<Id, WeeklyBehaviorRecord>();

  for (const week of rated) {
    const inWeek = (date: IsoDate) => date >= week.start && date <= week.end;
    for (const a of members) {
      const att = summarizeAttendance(attendance.filter((r) => r.apprenticeId === a.id && inWeek(r.date)));
      const pacing = tallyEod(eod.filter((r) => r.apprenticeId === a.id && inWeek(r.date)));
      if (att.total === 0) continue;
      const score = 0.55 * att.attendanceRate + 0.25 * att.punctualityRate + 0.2 * onPaceRate(pacing) + (rng.next() - 0.5) * 0.08;
      const rating = ratingFor(score);
      const note = rng.next() < 0.3 ? rng.pick(BEHAVIOR_CUSTOM_NOTES[rating]) : BEHAVIOR_DEFINITIONS[rating];
      const day = week.end < today ? week.end : addDays(today, -1);
      const recordedAt = at(day, 16, rng.int(0, 55));
      out.set(behaviorId(a.id, week.start), {
        id: behaviorId(a.id, week.start),
        apprenticeId: a.id,
        cohortId: cohort.id,
        weekStart: week.start,
        rating,
        note,
        recordedBy: a.coachId ?? members[0]!.coachId ?? a.id,
        recordedAt,
        createdAt: recordedAt,
        updatedAt: recordedAt,
      });
    }
  }

  // Planted drift: last week's rating dips for the apprentices whose EOD is sliding.
  if (lastCompleted) {
    const day = lastCompleted.end;
    driftIds.forEach((id, i) => {
      const a = members.find((m) => m.id === id);
      const rating = PLANTED_DRIFT_RATINGS[i];
      if (!a || !rating) return;
      const recordedAt = at(day, 16, 30);
      out.set(behaviorId(id, lastCompleted.start), {
        id: behaviorId(id, lastCompleted.start),
        apprenticeId: id,
        cohortId: cohort.id,
        weekStart: lastCompleted.start,
        rating,
        note: BEHAVIOR_DEFINITIONS[rating],
        recordedBy: a.coachId ?? id,
        recordedAt,
        createdAt: recordedAt,
        updatedAt: recordedAt,
      });
    });
  }
  return [...out.values()];
}

// ── Phase 2 sprint marks ──────────────────────────────────────────────────────

/** Four projects per specialization (one per sprint), keyed by specialization code. */
const SPRINT_PROJECTS: Readonly<Record<string, readonly [string, string, string, string]>> = {
  FS: ['Taskboard SPA', 'Realtime Chat', 'E-commerce Storefront', 'Capstone: Learning Portal'],
  JB: ['Inventory REST API', 'Payments Service', 'Event-driven Orders', 'Capstone: HR Platform API'],
  DE: ['Sales ETL Pipeline', 'Streaming Ingestion', 'Warehouse Data Model', 'Capstone: Analytics Lakehouse'],
  DO: ['CI/CD Pipeline', 'Container Platform', 'Observability Stack', 'Capstone: IaC Landing Zone'],
  QA: ['E2E Test Suite', 'API Contract Tests', 'Performance Test Plan', 'Capstone: Quality Gates'],
  PB: ['Booking Service API', 'Async Task Queue', 'Recommendation Service', 'Capstone: Clinic Platform'],
};

const SPRINT_SCORE_RANGE: Readonly<Record<Profile, readonly [number, number]>> = {
  star: [88, 98],
  steady: [72, 90],
  'late-riser': [68, 86],
  'at-risk': [52, 74],
};

const SPRINT_SUMMARIES: Readonly<Record<SprintBand, readonly string[]>> = {
  STRONG: [
    'Delivered every story with clean PRs and solid test coverage.',
    'Shipped ahead of the demo; strong code-review feedback.',
    'Owned the hardest story and unblocked teammates.',
  ],
  SOLID: [
    'Delivered the core scope; minor polish carried over.',
    'Met the sprint goal; tests cover the main paths.',
    'Good delivery; documentation needs tightening.',
  ],
  DEVELOPING: [
    'Partial delivery: two stories carried over.',
    'Core feature works but lacks tests; pairing recommended.',
    'Struggled with estimates; scope reduced mid-sprint.',
  ],
};

/** Sprint marks for cohorts in (or past) Phase 2: one per non-withdrawn apprentice per finished sprint. */
function buildSprintMarks(
  cohorts: readonly Cohort[],
  seeds: readonly CohortSeed[],
  apprentices: readonly Apprentice[],
  profiles: ReadonlyMap<Id, Profile>,
  specializations: readonly Specialization[],
  adminId: Id,
  today: IsoDate,
): SprintMark[] {
  const rng = new Prng(SPRINT_SEED);
  const codeOf = new Map(specializations.map((s) => [s.id, s.code]));
  const out: SprintMark[] = [];
  cohorts.forEach((cohort, idx) => {
    const plan = seeds[idx]?.sprints;
    if (!plan) return;
    const members = apprentices.filter((a) => a.cohortId === cohort.id && a.status !== 'WITHDRAWN');
    for (let n = 1; n <= plan.count; n++) {
      const sprintNumber = n as SprintNumber;
      const end = addDays(cohort.phase2StartDate, plan.cadenceDays * n - 3);
      if (end >= today) break;
      for (const a of members) {
        const code = codeOf.get(a.specializationId) ?? 'FS';
        const [lo, hi] = SPRINT_SCORE_RANGE[profiles.get(a.id) ?? 'steady'];
        const score = rng.int(lo, hi);
        const recordedAt = at(end, 15, rng.int(0, 55));
        out.push({
          id: sprintMarkId(a.id, sprintNumber),
          apprenticeId: a.id,
          cohortId: cohort.id,
          sprintNumber,
          projectName: (SPRINT_PROJECTS[code] ?? SPRINT_PROJECTS['FS']!)[n - 1]!,
          score,
          deliverableSummary: rng.pick(SPRINT_SUMMARIES[sprintBand(score)]),
          recordedBy: adminId,
          recordedAt,
          createdAt: recordedAt,
          updatedAt: recordedAt,
        });
      }
    }
  });
  return out;
}

