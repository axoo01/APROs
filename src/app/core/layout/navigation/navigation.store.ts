import { Injectable, computed, inject } from '@angular/core';
import { can } from '../../../domain';
import { AuthService } from '../../auth/auth.service';
import { NAV_ITEMS } from './nav-items.const';

@Injectable({ providedIn: 'root' })
export class NavigationStore {
  private readonly auth = inject(AuthService);
  readonly items = computed(() => {
    const role = this.auth.role();
    return NAV_ITEMS.filter((i) => !i.permission || can(role, i.permission));
  });
}
