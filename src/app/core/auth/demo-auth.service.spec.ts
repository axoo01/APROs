import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree, type CanMatchFn, type Route, type UrlSegment } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ForbiddenError, UnauthenticatedError } from '../../domain';
import { setupTestApp, TEST_NOW } from '../../testing/test-providers';
import { FixedClock } from '../platform/clock.service';
import { MemoryStorage } from '../platform/key-value-storage.service';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';
import { guestGuard } from './guest.guard';
import { permissionGuard } from './permission.guard';

const runGuard = (guard: typeof authGuard, path = 'dashboard') =>
  TestBed.runInInjectionContext(() => guard({} as Route, [{ path } as UrlSegment], {} as Parameters<CanMatchFn>[2]));

describe('DemoAuthService', () => {
  let storage: MemoryStorage;

  beforeEach(async () => {
    storage = new MemoryStorage();
    await setupTestApp({}, { clock: new FixedClock(TEST_NOW), storage });
  });

  it('signs in as a persona and exposes role + actor', async () => {
    const auth = TestBed.inject(AuthService);
    const session = await firstValueFrom(auth.loginAsPersona('ADMIN'));
    expect(session).toMatchObject({ role: 'ADMIN', fullName: 'Bob Karemera' });
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.actor()).toEqual({ userId: session.userId, role: 'ADMIN' });
  });

  it('signs in by email case-insensitively and rejects unknown emails', async () => {
    const auth = TestBed.inject(AuthService);
    expect((await firstValueFrom(auth.loginWithEmail('  JAMILLAH@apros.demo '))).role).toBe('COACH');
    await expect(firstValueFrom(auth.loginWithEmail('nobody@apros.demo'))).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('switches role by hopping personas', async () => {
    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.loginAsPersona('ADMIN'));
    await firstValueFrom(auth.switchRole('COACH'));
    expect(auth.role()).toBe('COACH');
  });

  it('restores the session after reload and clears it on logout', async () => {
    await firstValueFrom(TestBed.inject(AuthService).loginAsPersona('COACH'));
    TestBed.resetTestingModule();
    await setupTestApp({}, { clock: new FixedClock(TEST_NOW), storage });
    const auth = TestBed.inject(AuthService);
    expect(auth.role()).toBe('COACH');
    auth.logout();
    expect(auth.session()).toBeNull();
    expect(storage.getItem('apros.session')).toBeNull();
  });
});

describe('DemoAuthService outside Demo Mode', () => {
  it('disables persona login', async () => {
    await setupTestApp({ demoMode: false });
    await expect(firstValueFrom(TestBed.inject(AuthService).loginAsPersona('ADMIN'))).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('route guards', () => {
  beforeEach(async () => {
    await setupTestApp({}, undefined, [provideRouter([])]);
  });

  it('authGuard redirects anonymous users to /login with returnUrl', () => {
    const result = runGuard(authGuard) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Fdashboard');
  });

  it('authGuard admits signed-in users; guestGuard bounces them', async () => {
    await firstValueFrom(TestBed.inject(AuthService).loginAsPersona('COACH'));
    expect(runGuard(authGuard)).toBe(true);
    expect(runGuard(guestGuard)).toBeInstanceOf(UrlTree);
  });

  it('permissionGuard enforces RBAC', async () => {
    const auth = TestBed.inject(AuthService);
    await firstValueFrom(auth.loginAsPersona('COACH'));
    expect(runGuard(permissionGuard('cohort.create'))).toBeInstanceOf(UrlTree);
    expect(runGuard(permissionGuard('attendance.record'))).toBe(true);
    await firstValueFrom(auth.switchRole('ADMIN'));
    expect(runGuard(permissionGuard('cohort.create'))).toBe(true);
  });
});
