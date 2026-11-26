import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';
import type { Role } from '../../../../domain';
import { AuthService, type Session } from '../../../../core/auth/auth.service';
import { APP_CONFIG } from '../../../../core/config/app-config.token';
import { ReferenceDataStore } from '../../../../core/state/reference-data.store';
import { DEMO_PERSONAS, type DemoPersona } from '../../../../data/seed/personas.const';
import { AvatarComponent } from '../../../../shared/components/avatar/avatar.component';
import { IconComponent, type IconName } from '../../../../shared/components/icon/icon.component';
import { LogoComponent } from '../../../../shared/components/logo/logo.component';
import { errorMessage } from '../../../../shared/utils/error-message.util';

type Pending = Role | 'email' | null;

@Component({
  selector: 'ap-login-page',
  imports: [ReactiveFormsModule, AvatarComponent, IconComponent, LogoComponent],
  templateUrl: './login.page.html',
  styleUrl: './login.page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly refs = inject(ReferenceDataStore);
  protected readonly config = inject(APP_CONFIG);

  /** Bound from the query string via withComponentInputBinding(). */
  readonly returnUrl = input<string | undefined>();

  protected readonly highlights: readonly { icon: IconName; label: string }[] = [
    { icon: 'calendar-check', label: 'Instant check-ins' },
    { icon: 'gauge', label: 'Daily coaching' },
    { icon: 'dashboard', label: 'Cohort health' },
  ];

  protected readonly pending = signal<Pending>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly personas = computed(() => {
    const byEmail = new Map(this.refs.users().map((u) => [u.email, u]));
    return DEMO_PERSONAS.map((p) => ({ ...p, user: byEmail.get(p.email) ?? null }));
  });

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected signInAs(persona: DemoPersona): void {
    this.run(persona.role, this.auth.loginAsPersona(persona.role));
  }

  protected signInWithEmail(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.run('email', this.auth.loginWithEmail(this.form.getRawValue().email));
  }

  private run(kind: Exclude<Pending, null>, login$: Observable<Session>): void {
    if (this.pending()) return;
    this.pending.set(kind);
    this.error.set(null);
    login$.subscribe({
      next: () => void this.router.navigateByUrl(this.safeReturnUrl()),
      error: (err: unknown) => {
        this.error.set(errorMessage(err));
        this.pending.set(null);
      },
    });
  }

  /** Only allow in-app relative paths (prevents open redirects). */
  private safeReturnUrl(): string {
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
  }
}
