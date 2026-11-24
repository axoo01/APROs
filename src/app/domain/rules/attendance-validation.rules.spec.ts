import type { IsoDate } from '../models';
import { normalizeAttendanceInput } from './attendance-validation.rules';

const base = { apprenticeId: 'a1', date: '2026-11-23' as IsoDate };

describe('normalizeAttendanceInput', () => {
  it('clears reasons for P', () => {
    expect(normalizeAttendanceInput({ ...base, status: 'P', reason: 'TRAFFIC' })).toEqual({
      ok: true,
      value: { status: 'P', reason: null, note: null },
    });
  });

  it('keeps optional reasons for L and A', () => {
    expect(normalizeAttendanceInput({ ...base, status: 'L', reason: 'TRAFFIC' })).toMatchObject({ ok: true, value: { reason: 'TRAFFIC' } });
    expect(normalizeAttendanceInput({ ...base, status: 'A' })).toMatchObject({ ok: true, value: { reason: null } });
  });

  it('requires a reason for E', () => {
    expect(normalizeAttendanceInput({ ...base, status: 'E' })).toEqual({ ok: false, issues: ['Excused (E) requires a reason.'] });
    expect(normalizeAttendanceInput({ ...base, status: 'E', reason: 'SICK' })).toMatchObject({ ok: true });
  });

  it('trims notes and rejects oversized ones', () => {
    expect(normalizeAttendanceInput({ ...base, status: 'L', note: '   ' })).toMatchObject({ value: { note: null } });
    expect(normalizeAttendanceInput({ ...base, status: 'L', note: ' bus ' })).toMatchObject({ value: { note: 'bus' } });
    expect(normalizeAttendanceInput({ ...base, status: 'L', note: 'x'.repeat(281) })).toMatchObject({ ok: false });
  });

  it('rejects invalid dates', () => {
    expect(normalizeAttendanceInput({ ...base, date: '2026-02-30' as IsoDate, status: 'P' })).toMatchObject({ ok: false });
  });
});
