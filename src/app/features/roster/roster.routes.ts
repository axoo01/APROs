import type { Routes } from '@angular/router';

export const ROSTER_ROUTES: Routes = [
  {
    path: '',
    title: 'Apprentices · APROs',
    loadComponent: () => import('./pages/roster/roster.page').then((m) => m.RosterPage),
  },
];
