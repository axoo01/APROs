import { type EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer } from '@angular/core';
import { LocalApprenticeRepository } from './adapters/local/local-apprentice.repository';
import { LocalAttendanceRepository } from './adapters/local/local-attendance.repository';
import { LocalBehaviorRepository } from './adapters/local/local-behavior.repository';
import { LocalCohortRepository } from './adapters/local/local-cohort.repository';
import { LocalDemoData } from './adapters/local/local-demo-data.adapter';
import { LocalEodRepository } from './adapters/local/local-eod.repository';
import { LocalSprintRepository } from './adapters/local/local-sprint.repository';
import { LocalSpecializationRepository } from './adapters/local/local-specialization.repository';
import { LocalUserRepository } from './adapters/local/local-user.repository';
import { LocalDbService } from './local-db/local-db.service';
import { DemoDataPort } from './ports/demo-data.port';
import { ApprenticeRepository } from './ports/apprentice.repository';
import { AttendanceRepository } from './ports/attendance.repository';
import { BehaviorRepository } from './ports/behavior.repository';
import { CohortRepository } from './ports/cohort.repository';
import { EodRepository } from './ports/eod.repository';
import { SprintRepository } from './ports/sprint.repository';
import { SpecializationRepository } from './ports/specialization.repository';
import { UserRepository } from './ports/user.repository';

export type DataLayerKind = 'local';

/**
 * The single binding point between ports and adapters.
 * Swapping to the Spring Boot API = add `adapters/http/*` and a `'http'` branch here. Nothing else changes.
 */
export function provideDataLayer(kind: DataLayerKind = 'local'): EnvironmentProviders {
  switch (kind) {
    case 'local':
      return makeEnvironmentProviders([
        LocalDbService,
        { provide: UserRepository, useClass: LocalUserRepository },
        { provide: SpecializationRepository, useClass: LocalSpecializationRepository },
        { provide: CohortRepository, useClass: LocalCohortRepository },
        { provide: ApprenticeRepository, useClass: LocalApprenticeRepository },
        { provide: AttendanceRepository, useClass: LocalAttendanceRepository },
        { provide: EodRepository, useClass: LocalEodRepository },
        { provide: BehaviorRepository, useClass: LocalBehaviorRepository },
        { provide: SprintRepository, useClass: LocalSprintRepository },
        { provide: DemoDataPort, useClass: LocalDemoData },
        provideAppInitializer(() => inject(LocalDbService).init()),
      ]);
  }
}
