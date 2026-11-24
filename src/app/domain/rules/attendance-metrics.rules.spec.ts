import type { AttendanceStatus } from '../models';
import { attendanceRate, bucketOf, punctualityRate, summarizeAttendance, tallyAttendance } from './attendance-metrics.rules';

const records = (s: string) => [...s].map((status) => ({ status: status as AttendanceStatus }));

describe('attendance metrics', () => {
  it('tallies raw counts, keeping E distinct', () => {
    expect(tallyAttendance(records('PPLAEE'))).toEqual({ P: 2, L: 1, A: 1, E: 2, total: 6 });
  });

  it('Attendance Rate = (P + L) / (P + L + A)', () => {
    expect(attendanceRate(tallyAttendance(records('PPLA')))).toBe(0.75);
  });

  it('Punctuality Rate = P / (P + L)', () => {
    expect(punctualityRate(tallyAttendance(records('PPPL')))).toBe(0.75);
  });

  it('treats E as neutral: it never moves either rate', () => {
    const base = summarizeAttendance(records('PPLA'));
    const withExcused = summarizeAttendance(records('PPLAEEEE'));
    expect(withExcused.attendanceRate).toBe(base.attendanceRate);
    expect(withExcused.punctualityRate).toBe(base.punctualityRate);
    expect(withExcused.E).toBe(4);
  });

  it('defaults to 100% with empty denominators', () => {
    expect(attendanceRate(tallyAttendance([]))).toBe(1);
    expect(attendanceRate(tallyAttendance(records('EE')))).toBe(1);
    expect(punctualityRate(tallyAttendance(records('AE')))).toBe(1);
  });

  it('is 0% when only absences are recorded', () => {
    expect(attendanceRate(tallyAttendance(records('AA')))).toBe(0);
  });

  it('maps statuses to the three Sweep buckets', () => {
    expect(bucketOf(undefined)).toBe('NOT_HERE_YET');
    expect(bucketOf(null)).toBe('NOT_HERE_YET');
    expect(bucketOf('P')).toBe('PRESENT');
    expect(bucketOf('L')).toBe('PRESENT');
    expect(bucketOf('A')).toBe('ABSENT_EXCUSED');
    expect(bucketOf('E')).toBe('ABSENT_EXCUSED');
  });
});
