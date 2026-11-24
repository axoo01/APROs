import { Injectable, inject } from '@angular/core';
import { Observable, map, take } from 'rxjs';
import { selectAll, type User } from '../../../domain';
import { LocalDbService } from '../../local-db/local-db.service';
import { UserRepository } from '../../ports/user.repository';

@Injectable()
export class LocalUserRepository extends UserRepository {
  private readonly db = inject(LocalDbService);

  watchAll(): Observable<readonly User[]> {
    return this.db.table$('users').pipe(
      map((t) => selectAll(t).sort((a, b) => a.fullName.localeCompare(b.fullName))),
    );
  }

  findByEmail(email: string): Observable<User | null> {
    const needle = email.trim().toLowerCase();
    return this.db.table$('users').pipe(
      take(1),
      map((t) => selectAll(t).find((u) => u.isActive && u.email.toLowerCase() === needle) ?? null),
    );
  }
}
