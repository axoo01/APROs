import type { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    title: 'Settings · APROs',
    loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage),
  },
];
