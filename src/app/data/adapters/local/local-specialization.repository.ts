import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { selectAll, type Specialization } from '../../../domain';
import { LocalDbService } from '../../local-db/local-db.service';
import { SpecializationRepository } from '../../ports/specialization.repository';

@Injectable()
export class LocalSpecializationRepository extends SpecializationRepository {
  private readonly db = inject(LocalDbService);

  watchAll(): Observable<readonly Specialization[]> {
    return this.db.table$('specializations').pipe(
      map((t) => selectAll(t).sort((a, b) => a.name.localeCompare(b.name))),
    );
  }
}
