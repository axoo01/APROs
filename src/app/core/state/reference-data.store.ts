import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Id, Specialization, User } from '../../domain';
import { SpecializationRepository } from '../../data/ports/specialization.repository';
import { UserRepository } from '../../data/ports/user.repository';
import { AuthService } from '../auth/auth.service';

/** App-wide lookups (users, specializations) as signals + O(1) maps. */
@Injectable({ providedIn: 'root' })
export class ReferenceDataStore {
  private readonly auth = inject(AuthService);

  readonly users = toSignal(inject(UserRepository).watchAll(), { initialValue: [] as readonly User[] });
  readonly specializations = toSignal(inject(SpecializationRepository).watchAll(), {
    initialValue: [] as readonly Specialization[],
  });

  readonly userById = computed(() => new Map<Id, User>(this.users().map((u) => [u.id, u])));
  readonly specializationById = computed(
    () => new Map<Id, Specialization>(this.specializations().map((s) => [s.id, s])),
  );
  readonly coaches = computed(() => this.users().filter((u) => u.role === 'COACH' && u.isActive));
  /** Coach picker options (id + display name), alphabetical. */
  readonly coachOptions = computed(() =>
    this.coaches()
      .map((u) => ({ id: u.id, name: u.fullName }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  readonly currentUser = computed(() => {
    const s = this.auth.session();
    return s ? (this.userById().get(s.userId) ?? null) : null;
  });
  /** The signed-in user coaches apprentices (drives the "Mine" filter). */
  readonly currentUserIsCoach = computed(() => this.currentUser()?.role === 'COACH');
}
