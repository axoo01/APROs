import type { Routes } from '@angular/router';

export const ATTENDANCE_ROUTES: Routes = [
  {
    path: '',
    title: 'Attendance · APROs',
    loadComponent: () => import('./pages/attendance/attendance.page').then((m) => m.AttendancePage),
  },
  {
    path: 'log',
    title: 'Attendance log · APROs',
    loadComponent: () => import('./pages/attendance-log/attendance-log.page').then((m) => m.AttendanceLogPage),
  },
];
