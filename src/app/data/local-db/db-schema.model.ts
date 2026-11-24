import type { Apprentice, AttendanceRecord, Cohort, EntityTable, IsoDateTime, Specialization, User } from '../../domain';

export const DB_SCHEMA_VERSION = 1;
export const DB_STORAGE_KEY = 'apros.db';

export interface DbSchema {
  readonly schemaVersion: number;
  readonly seededAt: IsoDateTime;
  readonly users: EntityTable<User>;
  readonly specializations: EntityTable<Specialization>;
  readonly cohorts: EntityTable<Cohort>;
  readonly apprentices: EntityTable<Apprentice>;
  readonly attendance: EntityTable<AttendanceRecord>;
}

export type DbTableKey = Exclude<keyof DbSchema, 'schemaVersion' | 'seededAt'>;

const TABLE_KEYS: readonly DbTableKey[] = ['users', 'specializations', 'cohorts', 'apprentices', 'attendance'];

function isTable(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as { ids?: unknown; entities?: unknown };
  return Array.isArray(t.ids) && typeof t.entities === 'object' && t.entities !== null;
}

/** Structural guard for data read from storage (untrusted: may be stale, partial or hand-edited). */
export function isDbSchema(value: unknown): value is DbSchema {
  if (typeof value !== 'object' || value === null) return false;
  const db = value as Record<string, unknown>;
  return typeof db['schemaVersion'] === 'number' && TABLE_KEYS.every((k) => isTable(db[k]));
}

/**
 * Forward migrations keyed by the version they upgrade FROM.
 * Add `1: (db) => ({ ...db, schemaVersion: 2, newTable: emptyTable() })` when the schema evolves.
 */
export const MIGRATIONS: Readonly<Record<number, (db: DbSchema) => DbSchema>> = {};

export function migrate(db: DbSchema): DbSchema | null {
  let current = db;
  while (current.schemaVersion < DB_SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schemaVersion];
    if (!step) return null;
    current = step(current);
  }
  return current.schemaVersion === DB_SCHEMA_VERSION ? current : null;
}
