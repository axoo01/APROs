import type { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: '',
    title: 'Sign in · APROs',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
];
