import { ForbiddenError } from '../errors/domain.errors';
import { assertCan, can, PERMISSIONS } from './permissions.rules';

describe('permissions', () => {
  it('grants ADMIN everything', () => {
    for (const p of PERMISSIONS) expect(can('ADMIN', p)).toBe(true);
  });

  it('lets COACH record coaching data for anyone, view and export', () => {
    for (const p of ['attendance.record', 'eod.record', 'behavior.record', 'dashboard.view', 'data.export'] as const) {
      expect(can('COACH', p)).toBe(true);
    }
  });

  it('denies COACH cohort, onboarding and sprint management', () => {
    for (const p of ['cohort.create', 'cohort.delete', 'specialization.manage', 'apprentice.onboard', 'apprentice.assign', 'sprint.record'] as const) {
      expect(can('COACH', p)).toBe(false);
    }
  });

  it('denies anonymous users and throws ForbiddenError on assert', () => {
    expect(can(null, 'dashboard.view')).toBe(false);
    expect(() => assertCan('COACH', 'cohort.create')).toThrow(ForbiddenError);
    expect(() => assertCan('ADMIN', 'cohort.create')).not.toThrow();
  });
});
