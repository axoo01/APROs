import { emptyTable, removeOne, selectAll, selectById, tableFrom, upsertMany, upsertOne } from './entity-table.util';

interface Row {
  readonly id: string;
  readonly v: number;
}

describe('entity table', () => {
  it('builds from items preserving order and de-duplicating', () => {
    const t = tableFrom<Row>([{ id: 'a', v: 1 }, { id: 'b', v: 2 }, { id: 'a', v: 3 }]);
    expect(t.ids).toEqual(['a', 'b']);
    expect(selectById(t, 'a')?.v).toBe(3);
  });

  it('upserts immutably', () => {
    const t0 = emptyTable<Row>();
    const t1 = upsertOne(t0, { id: 'a', v: 1 });
    const t2 = upsertOne(t1, { id: 'a', v: 2 });
    expect(t0.ids).toEqual([]);
    expect(t2.ids).toEqual(['a']);
    expect(selectById(t2, 'a')?.v).toBe(2);
    expect(selectById(t1, 'a')?.v).toBe(1);
  });

  it('returns the same instance for no-op changes', () => {
    const row = { id: 'a', v: 1 };
    const t = tableFrom<Row>([row]);
    expect(upsertOne(t, row)).toBe(t);
    expect(upsertMany(t, [])).toBe(t);
    expect(removeOne(t, 'missing')).toBe(t);
  });

  it('upserts many and removes', () => {
    const t = upsertMany(tableFrom<Row>([{ id: 'a', v: 1 }]), [{ id: 'b', v: 2 }, { id: 'a', v: 9 }]);
    expect(selectAll(t).map((r) => r.v)).toEqual([9, 2]);
    expect(selectAll(removeOne(t, 'a'))).toEqual([{ id: 'b', v: 2 }]);
  });
});
