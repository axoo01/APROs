import {
  emptyTable,
  type Apprentice,
  type AttendanceRecord,
  type Cohort,
  type EntityTable,
  type EodPacingRecord,
  type IsoDateTime,
  type Specialization,
  type SprintMark,
  type User,
  type WeeklyBehaviorRecord,
} from '../../domain';

export const DB_SCHEMA_VERSION = 4;
export const DB_STORAGE_KEY = 'apros.db';

export interface DbSchema {
  readonly schemaVersion: number;
  readonly seededAt: IsoDateTime;
  readonly users: EntityTable<User>;
  readonly specializations: EntityTable<Specialization>;
  readonly cohorts: EntityTable<Cohort>;
  readonly apprentices: EntityTable<Apprentice>;
  readonly attendance: EntityTable<AttendanceRecord>;
  /** Since v2. */
  readonly eodPacing: EntityTable<EodPacingRecord>;
  /** Since v3. */
  readonly weeklyBehavior: EntityTable<WeeklyBehaviorRecord>;
  /** Since v4. */
  readonly sprintMarks: EntityTable<SprintMark>;
}

export type DbTableKey = Exclude<keyof DbSchema, 'schemaVersion' | 'seededAt'>;

/** Tables every stored version has (v1). Newer tables are added by migrations, so they aren't required here. */
const BASE_TABLE_KEYS: readonly DbTableKey[] = ['users', 'specializations', 'cohorts', 'apprentices', 'attendance'];

function isTable(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as { ids?: unknown; entities?: unknown };
  return Array.isArray(t.ids) && typeof t.entities === 'object' && t.entities !== null;
}

/** Structural guard for data read from storage (untrusted: may be stale, partial or hand-edited). */
export function isDbSchema(value: unknown): value is DbSchema {
  if (typeof value !== 'object' || value === null) return false;
  const db = value as Record<string, unknown>;
  return typeof db['schemaVersion'] === 'number' && BASE_TABLE_KEYS.every((k) => isTable(db[k]));
}

/** Forward migrations keyed by the version they upgrade FROM. */
export const MIGRATIONS: Readonly<Record<number, (db: DbSchema) => DbSchema>> = {
  // v2: EOD pacing table (existing data is kept; history starts empty until "Reset Demo Data").
  1: (db) => ({ ...db, schemaVersion: 2, eodPacing: emptyTable<EodPacingRecord>() }),
  // v3: weekly behavior table.
  2: (db) => ({ ...db, schemaVersion: 3, weeklyBehavior: emptyTable<WeeklyBehaviorRecord>() }),
  // v4: Phase 2 sprint marks.
  3: (db) => ({ ...db, schemaVersion: 4, sprintMarks: emptyTable<SprintMark>() }),
};

export function migrate(db: DbSchema): DbSchema | null {
  let current = db;
  while (current.schemaVersion < DB_SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schemaVersion];
    if (!step) return null;
    current = step(current);
  }
  return current.schemaVersion === DB_SCHEMA_VERSION ? current : null;
}
