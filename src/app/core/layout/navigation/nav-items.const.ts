import type { Permission } from '../../../domain';
import type { IconName } from '../../../shared/components/icon/icon.component';

export interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: IconName;
  /** Hidden unless the current role holds this permission. */
  readonly permission?: Permission;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Attendance', path: '/attendance', icon: 'calendar-check', permission: 'attendance.record' },
  { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', permission: 'dashboard.view' },
  { label: 'Roster', path: '/roster', icon: 'users' },
  { label: 'Cohorts', path: '/cohorts', icon: 'layers', permission: 'cohort.create' },
  { label: 'Settings', path: '/settings', icon: 'settings' },
];
