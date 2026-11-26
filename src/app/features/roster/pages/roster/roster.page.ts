import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { CohortHealthStore } from '../../../../core/state/cohort-health.store';
import { ApprenticePassportComponent } from '../../../../shared/components/apprentice-passport/apprentice-passport.component';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { colorTagVar } from '../../../../shared/utils/color-tag.util';
import { ReadinessBannerComponent } from '../../components/readiness-banner/readiness-banner.component';
import { VibeCheckComponent } from '../../components/vibe-check/vibe-check.component';
import { ReadinessReportComponent } from '../../components/readiness-report/readiness-report.component';
import { TIER_TONE } from '../../../../shared/utils/health-tier.const';
import {
  ApprenticesFacade,
  parseHealthView,
  type ApprenticeRow,
  type ApprenticeSortKey,
} from '../../data-access/apprentices.facade';

interface Column {
  readonly label: string;
  /** Width utility for the fixed table layout ('' = takes the remaining space). */
  readonly width: string;
  readonly sort: ApprenticeSortKey | null;
}

/** Apprentices directory & Phase 2 readiness report (route `/roster`). Rows open the shared 360° passport. */
@Component({
  selector: 'ap-roster-page',
  imports: [
    ApprenticePassportComponent,
    AvatarComponent,
    IconComponent,
    PageHeaderComponent,
    ReadinessBannerComponent,
    ReadinessReportComponent,
    VibeCheckComponent,
  ],
  providers: [CohortHealthStore, ApprenticesFacade],
  templateUrl: './roster.page.html',
  styleUrl: './roster.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterPage {
  protected readonly f = inject(ApprenticesFacade);
  private readonly router = inject(Router);
  protected readonly tierTone = TIER_TONE;

  /** Query params (withComponentInputBinding): `view` (risk | flagged | thriving), `spec` (track id), `sort` (vibe-desc …). */
  readonly view = input<string>();
  readonly spec = input<string>();
  readonly sort = input<string>();

  constructor() {
    // URL → filters. Re-applied whenever the query string changes (e.g. clearing the chip, back/forward).
    effect(() => {
      const view = parseHealthView(this.view());
      const spec = this.spec() ?? null;
      const sort = this.sort();
      untracked(() => {
        this.f.healthView.set(view);
        if (spec) this.f.specFilter.set(spec);
        const [key, dir] = (sort ?? '').split('-');
        const keys: Record<string, ApprenticeSortKey> = { name: 'NAME', coach: 'COACH', vibe: 'VIBE', readiness: 'READINESS' };
        if (key && keys[key]) this.f.sort.set({ key: keys[key], dir: dir === 'desc' ? 'desc' : 'asc' });
        else if (view) this.f.sort.set({ key: 'VIBE', dir: view === 'thriving' ? 'desc' : 'asc' });
      });
    });
  }

  protected clearHealthView(): void {
    void this.router.navigate([], { queryParams: { view: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }
  protected readonly reportOpen = signal(false);

  protected readonly tag = colorTagVar;

  /** Fixed-layout columns so every row lines up, whatever data it has. */
  protected readonly columns = computed<readonly Column[]>(() => [
    { label: 'Apprentice', width: '', sort: 'NAME' },
    { label: 'Track', width: 'w-40', sort: null },
    { label: 'Coach', width: 'w-32', sort: 'COACH' },
    { label: 'Vibe check', width: 'w-[15.5rem]', sort: 'VIBE' },
    this.f.showReadiness()
      ? { label: 'Readiness', width: 'w-40', sort: 'READINESS' }
      : { label: 'Sprint avg', width: 'w-32', sort: null },
  ]);

  protected readonly sortOptions: readonly { key: ApprenticeSortKey; label: string }[] = [
    { key: 'NAME', label: 'Apprentice' },
    { key: 'COACH', label: 'Coach' },
    { key: 'VIBE', label: 'Vibe check' },
    { key: 'READINESS', label: 'Readiness' },
  ];

  protected ariaSort(key: ApprenticeSortKey | null): 'ascending' | 'descending' | 'none' | null {
    if (!key) return null;
    const s = this.f.sort();
    return s.key !== key ? 'none' : s.dir === 'asc' ? 'ascending' : 'descending';
  }

  /** Phone sort menu: "NAME:asc" etc. */
  protected pickSort(value: string): void {
    const [key, dir] = value.split(':') as [ApprenticeSortKey, 'asc' | 'desc'];
    this.f.sort.set({ key, dir });
  }

  protected readonly specName = computed(() => {
    const id = this.f.specFilter();
    return id ? (this.f.specializations().find((s) => s.id === id)?.code ?? null) : null;
  });

  protected standingTone(r: ApprenticeRow): string {
    if (!r.health) return 'bg-surface-2 text-fg-subtle';
    if (!this.f.showReadiness()) return 'bg-surface-2 text-fg';
    return r.health.readiness === 'READY' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning';
  }

  protected standingLabel(r: ApprenticeRow): string {
    if (r.apprentice.status === 'WITHDRAWN') return 'Withdrawn';
    if (this.f.showReadiness()) return r.health?.readiness === 'READY' ? 'Ready' : 'Pairing Support';
    return r.health?.sprintAverage !== null && r.health?.sprintAverage !== undefined ? `Avg ${r.health.sprintAverage}` : '—';
  }

  protected copyBrief(): void {
    void this.f.copyBrief();
  }
}
