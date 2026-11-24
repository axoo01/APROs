import type { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { guestGuard } from './core/auth/guest.guard';
import { permissionGuard } from './core/auth/permission.guard';

/** Top-level map only: guards + lazy feature route files. Each feature owns its own `<feature>.routes.ts`. */
export const routes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./core/layout/app-shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'attendance' },
      {
        path: 'attendance',
        canMatch: [permissionGuard('attendance.record')],
        loadChildren: () => import('./features/attendance/attendance.routes').then((m) => m.ATTENDANCE_ROUTES),
      },
      {
        path: 'dashboard',
        canMatch: [permissionGuard('dashboard.view')],
        loadChildren: () => import('./features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES),
      },
      {
        path: 'roster',
        loadChildren: () => import('./features/roster/roster.routes').then((m) => m.ROSTER_ROUTES),
      },
      {
        path: 'cohorts',
        canMatch: [permissionGuard('cohort.create')],
        loadChildren: () => import('./features/cohorts/cohorts.routes').then((m) => m.COHORTS_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then((m) => m.SETTINGS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
