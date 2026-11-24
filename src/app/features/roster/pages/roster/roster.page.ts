import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { apprenticeDisplayName, type Apprentice, type Id } from '../../../../domain';
import { CohortContextStore } from '../../../../core/state/cohort-context.store';
import { ReferenceDataStore } from '../../../../core/state/reference-data.store';
import { ApprenticeRepository } from '../../../../data/ports/apprentice.repository';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { streamFor } from '../../../../shared/utils/stream-for.util';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';

const STATUS_STYLE: Record<Apprentice['status'], string> = {
  ACTIVE: 'bg-success-soft text-success',
  WITHDRAWN: 'bg-surface-2 text-fg-subtle',
  GRADUATED: 'bg-info-soft text-info',
};

@Component({
  selector: 'ap-roster-page',
  imports: [TitleCasePipe, AvatarComponent, IconComponent, PageHeaderComponent],
  templateUrl: './roster.page.html',
  styleUrl: './roster.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterPage {
  private readonly ctx = inject(CohortContextStore);
  private readonly repo = inject(ApprenticeRepository);
  protected readonly refs = inject(ReferenceDataStore);
  protected readonly tag = colorTagVar;

  protected readonly query = signal('');
  protected readonly specFilter = signal<Id | null>(null);

  /** RxJS for input timing: debounce keystrokes before filtering. */
  private readonly debouncedQuery = toSignal(
    toObservable(this.query).pipe(
      debounceTime(150),
      map((q) => q.trim().toLowerCase()),
      distinctUntilChanged(),
    ),
    { initialValue: '' },
  );

  private readonly cohortId = computed(() => this.ctx.activeCohort()?.id ?? null);
  protected readonly apprentices = streamFor(this.cohortId, (id) => this.repo.watchByCohort(id), [] as readonly Apprentice[]);

  private readonly enriched = computed(() => {
    const specs = this.refs.specializationById();
    const users = this.refs.userById();
    return this.apprentices().map((a) => {
      const spec = specs.get(a.specializationId);
      const coachName = a.coachId ? (users.get(a.coachId)?.fullName ?? null) : null;
      const name = apprenticeDisplayName(a);
      return {
        a,
        name,
        coachName,
        specName: spec?.name ?? '—',
        specColor: spec ? colorTagVar(spec.colorTag) : 'transparent',
        statusStyle: STATUS_STYLE[a.status],
        haystack: `${name} ${a.email} ${coachName ?? 'unassigned'}`.toLowerCase(),
      };
    });
  });

  protected readonly rows = computed(() => {
    const q = this.debouncedQuery();
    const spec = this.specFilter();
    return this.enriched().filter((r) => (!spec || r.a.specializationId === spec) && (!q || r.haystack.includes(q)));
  });

  protected toggleSpec(id: Id): void {
    this.specFilter.update((cur) => (cur === id ? null : id));
  }
}
