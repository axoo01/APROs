import type { Routes } from '@angular/router';

export const COHORTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Cohorts · APROs',
    loadComponent: () => import('./pages/cohorts/cohorts.page').then((m) => m.CohortsPage),
  },
];
