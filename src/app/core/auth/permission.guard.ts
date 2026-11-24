import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { can, type Permission } from '../../domain';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AuthService } from './auth.service';

/** Route-level RBAC (UX only — local adapters enforce the same rules on every command). */
export function permissionGuard(permission: Permission): CanMatchFn {
  return () => {
    if (can(inject(AuthService).role(), permission)) return true;
    inject(ToastService).show({ tone: 'warning', message: "You don't have access to that area." });
    return inject(Router).createUrlTree(['/']);
  };
}
