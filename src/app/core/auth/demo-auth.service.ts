import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { ForbiddenError, UnauthenticatedError, ROLES, type Role, type User } from '../../domain';
import type { Actor } from '../../data/ports/actor-context.port';
import { UserRepository } from '../../data/ports/user.repository';
import { personaFor } from '../../data/seed/personas.const';
import { APP_CONFIG } from '../config/app-config.token';
import { Clock } from '../platform/clock.service';
import { KeyValueStorage } from '../platform/key-value-storage.service';
import { AuthService, type Session } from './auth.service';

const SESSION_KEY = 'apros.session';

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s['userId'] === 'string' &&
    typeof s['fullName'] === 'string' &&
    typeof s['email'] === 'string' &&
    typeof s['startedAt'] === 'string' &&
    ROLES.includes(s['role'] as Role)
  );
}

@Injectable()
export class DemoAuthService extends AuthService {
  private readonly users = inject(UserRepository);
  private readonly storage = inject(KeyValueStorage);
  private readonly clock = inject(Clock);
  private readonly config = inject(APP_CONFIG);

  private readonly _session = signal<Session | null>(this.restore());
  readonly session = this._session.asReadonly();
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly role = computed(() => this._session()?.role ?? null);

  loginWithEmail(email: string): Observable<Session> {
    return this.users.findByEmail(email).pipe(
      map((user) => {
        if (!user) throw new UnauthenticatedError('No active account found for that email.');
        return this.start(user);
      }),
    );
  }

  loginAsPersona(role: Role): Observable<Session> {
    if (!this.config.demoMode) return throwError(() => new ForbiddenError('Persona login is only available in Demo Mode.'));
    return this.loginWithEmail(personaFor(role).email);
  }

  switchRole(role: Role): Observable<Session> {
    return this.loginAsPersona(role);
  }

  logout(): void {
    this.storage.removeItem(SESSION_KEY);
    this._session.set(null);
  }

  actor(): Actor | null {
    const s = this._session();
    return s ? { userId: s.userId, role: s.role } : null;
  }

  private start(user: User): Session {
    const session: Session = {
      userId: user.id,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      startedAt: this.clock.now().toISOString(),
    };
    this.storage.setItem(SESSION_KEY, JSON.stringify(session));
    this._session.set(session);
    return session;
  }

  private restore(): Session | null {
    try {
      const raw = this.storage.getItem(SESSION_KEY);
      const value: unknown = raw ? JSON.parse(raw) : null;
      return isSession(value) ? value : null;
    } catch {
      return null;
    }
  }
}
