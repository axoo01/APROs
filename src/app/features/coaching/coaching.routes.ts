import type { Routes } from '@angular/router';

export const COACHING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'eod' },
  {
    path: 'eod',
    title: "Today's EOD · APROs",
    loadComponent: () => import('./pages/eod/eod.page').then((m) => m.EodPage),
  },
  {
    path: 'eod/log',
    title: 'EOD log · APROs',
    loadComponent: () => import('./pages/eod-log/eod-log.page').then((m) => m.EodLogPage),
  },
  {
    path: 'behavior',
    title: 'Weekly behavior · APROs',
    loadComponent: () => import('./pages/weekly-behavior/weekly-behavior.page').then((m) => m.WeeklyBehaviorPage),
  },
];
