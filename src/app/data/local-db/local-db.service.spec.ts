import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { selectAll } from '../../domain';
import { FixedClock } from '../../core/platform/clock.service';
import { MemoryStorage } from '../../core/platform/key-value-storage.service';
import { setupTestApp, TEST_NOW } from '../../testing/test-providers';
import { DB_SCHEMA_VERSION, DB_STORAGE_KEY, migrate, type DbSchema } from './db-schema.model';
import { LocalDbService } from './local-db.service';

const flush = () => new Promise((r) => setTimeout(r, 5));

describe('LocalDbService', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('seeds and persists on first run', async () => {
    await setupTestApp({}, { clock: new FixedClock(TEST_NOW), storage });
    expect(TestBed.inject(LocalDbService).initOutcome()).toBe('seeded');
    const saved = JSON.parse(storage.getItem(DB_STORAGE_KEY)!) as DbSchema;
    expect(saved.schemaVersion).toBe(DB_SCHEMA_VERSION);
    expect(saved.cohorts.ids.length).toBe(4);
  });

  it('loads existing data instead of reseeding', async () => {
    await setupTestApp({}, { clock: new FixedClock(TEST_NOW), storage });
    const db = TestBed.inject(LocalDbService);
    await firstValueFrom(
      db.write((s) => ({ db: { ...s, seededAt: 'marker' }, result: null })),
    );
    await flush();
    TestBed.resetTestingModule();

    await setupTestApp({}, { clock: new FixedClock(TEST_NOW), storage });
    const reloaded = TestBed.inject(LocalDbService);
    expect(reloaded.initOutcome()).toBe('loaded');
    expect(reloaded.snapshot().seededAt).toBe('marker');
  });

  it('recovers from corrupted storage by reseeding', async () => {
    storage.setItem(DB_STORAGE_KEY, '{not json');
    await setupTestApp({}, { clock: new FixedClock(TEST_NOW), storage });
    expect(TestBed.inject(LocalDbService).initOutcome()).toBe('recovered');
    expect(TestBed.inject(LocalDbService).snapshot().cohorts.ids.length).toBe(4);
  });

  it('leaves state untouched when a mutation throws', async () => {
    await setupTestApp({}, { clock: new FixedClock(TEST_NOW), storage });
    const db = TestBed.inject(LocalDbService);
    const before = db.snapshot();
    await expect(
      firstValueFrom(
        db.write(() => {
          throw new Error('boom');
        }),
      ),
    ).rejects.toThrow('boom');
    expect(db.snapshot()).toBe(before);
  });

  it('only re-emits a table when that table changes', async () => {
    await setupTestApp({}, { clock: new FixedClock(TEST_NOW), storage });
    const db = TestBed.inject(LocalDbService);
    const emissions: number[] = [];
    const sub = db.table$('cohorts').subscribe((t) => emissions.push(t.ids.length));
    await firstValueFrom(db.write((s) => ({ db: { ...s, seededAt: 'x' }, result: null })));
    sub.unsubscribe();
    expect(emissions).toEqual([4]);
  });

  it('resets to the seed', async () => {
    await setupTestApp({}, { clock: new FixedClock(TEST_NOW), storage });
    const db = TestBed.inject(LocalDbService);
    await firstValueFrom(db.write((s) => ({ db: { ...s, attendance: { ids: [], entities: {} } }, result: null })));
    expect(selectAll(db.snapshot().attendance)).toHaveLength(0);
    await db.resetToSeed();
    expect(selectAll(db.snapshot().attendance).length).toBeGreaterThan(1000);
  });

  it('migrates a v1 store forward, keeping data and adding the EOD table', () => {
    const v1 = {
      schemaVersion: 1,
      seededAt: '2026-11-23T08:00:00.000Z',
      users: { ids: [], entities: {} },
      specializations: { ids: [], entities: {} },
      cohorts: { ids: [], entities: {} },
      apprentices: { ids: [], entities: {} },
      attendance: { ids: ['x'], entities: { x: {} } },
    } as unknown as DbSchema;
    const migrated = migrate(v1);
    expect(migrated?.schemaVersion).toBe(DB_SCHEMA_VERSION);
    expect(migrated?.eodPacing).toEqual({ ids: [], entities: {} });
    expect(migrated?.attendance.ids).toEqual(['x']);
  });
});
