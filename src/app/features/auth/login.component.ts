import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-container">
      <div class="auth-card card">
        <div class="brand-header">
          <img
            src="assets/brand/nacs-mark-square.png"
            alt="NACS Sunburst Emblem"
            class="auth-logo"
            width="56"
            height="56"
          />
          <h1 class="h2">Federation Sign In</h1>
          <p class="text-muted text-small">
            Sign in to access your student society dashboard or board portal.
          </p>
        </div>

        @if (errorMessage()) {
          <div class="alert alert-error" role="alert">
            {{ errorMessage() }}
          </div>
        }

        <!-- ⚡ Quick 1-Click Demo Accounts -->
        <div class="demo-section">
          <div class="demo-section-header">
            <span class="demo-badge">⚡ Instant Preview</span>
            <span class="demo-title">Test Demo Accounts</span>
          </div>
          <p class="demo-desc">
            Explore role-protected features instantly without passwords:
          </p>
          <div class="demo-buttons-stack">
            <button
              type="button"
              class="btn-demo-account btn-demo-admin"
              (click)="onDemoLogin('admin', '/admin')"
              [disabled]="isLoading()"
            >
              <div class="demo-acc-icon">🛡️</div>
              <div class="demo-acc-info">
                <div class="demo-acc-header">
                  <span class="demo-acc-role">Board Admin</span>
                  <span class="demo-acc-tag tag-admin">Governance</span>
                </div>
                <div class="demo-acc-email">admin@nacs.dz</div>
                <div class="demo-acc-route">Applications & Moderation Queue (/admin)</div>
              </div>
            </button>

            <button
              type="button"
              class="btn-demo-account btn-demo-lead"
              (click)="onDemoLogin('club_lead', '/lead')"
              [disabled]="isLoading()"
            >
              <div class="demo-acc-icon">🚀</div>
              <div class="demo-acc-info">
                <div class="demo-acc-header">
                  <span class="demo-acc-role">Club Lead</span>
                  <span class="demo-acc-tag tag-lead">Alpha Robotics</span>
                </div>
                <div class="demo-acc-email">lead@alpharobotics.dz</div>
                <div class="demo-acc-route">Club Profile, Events & Projects (/lead)</div>
              </div>
            </button>

            <button
              type="button"
              class="btn-demo-account btn-demo-visitor"
              (click)="onDemoLogin('visitor', '/clubs')"
              [disabled]="isLoading()"
            >
              <div class="demo-acc-icon">🎓</div>
              <div class="demo-acc-info">
                <div class="demo-acc-header">
                  <span class="demo-acc-role">Student Visitor</span>
                  <span class="demo-acc-tag tag-visitor">Public</span>
                </div>
                <div class="demo-acc-email">student@usthb.dz</div>
                <div class="demo-acc-route">Browse Directory, Calendar & Showcase (/clubs)</div>
              </div>
            </button>
          </div>
        </div>

        <div class="divider">
          <span>or sign in with credentials</span>
        </div>

        <!-- Primary Auth Method: Google Sign-In -->
        <button
          type="button"
          class="btn btn-google"
          (click)="onGoogleSignIn()"
          [disabled]="isLoading()"
        >
          <svg class="google-icon" viewBox="24" width="20" height="20">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div class="divider">
          <span>or with email</span>
        </div>

        <!-- Fallback Method: Email & Password -->
        <form [formGroup]="loginForm" (ngSubmit)="onEmailSubmit()" class="login-form">
          <div class="form-group">
            <label for="email" class="form-label">University Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              class="form-input"
              placeholder="lead@univ.dz"
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label for="password" class="form-label">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              class="form-input"
              placeholder="••••••••"
              autocomplete="current-password"
            />
          </div>

          <div class="form-actions">
            <button
              type="submit"
              class="btn btn-primary btn-full"
              [disabled]="loginForm.invalid || isLoading()"
            >
              {{ isSignUpMode() ? 'Create Account' : 'Sign In' }}
            </button>
          </div>
        </form>

        <div class="auth-toggle">
          <button
            type="button"
            class="toggle-link"
            (click)="isSignUpMode.set(!isSignUpMode())"
          >
            {{ isSignUpMode() ? 'Already have an account? Sign In' : "Don't have an account? Sign Up" }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 60vh;
      padding: 1.5rem 1rem;
    }
    .auth-card {
      width: 100%;
      max-width: 480px;
      padding: 2.25rem 2rem;
      background: var(--nacs-surface);
      border: 1px solid var(--nacs-border);
      border-radius: var(--radius-md);
      box-shadow: var(--elevation-1);
    }
    .brand-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }
    .auth-logo {
      border-radius: var(--radius-xs);
      margin-bottom: 0.75rem;
    }

    /* --- Demo Section Styles --- */
    .demo-section {
      background: rgba(13, 13, 255, 0.03);
      border: 1px solid var(--nacs-border-strong);
      border-radius: var(--radius-sm);
      padding: 1rem;
      margin-bottom: 1.25rem;
    }
    .demo-section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }
    .demo-badge {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 0.15rem 0.5rem;
      border-radius: 999px;
      background: var(--nacs-primary-soft);
      color: var(--nacs-primary);
    }
    .demo-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--nacs-text);
    }
    .demo-desc {
      font-size: 0.78rem;
      color: var(--nacs-text-muted);
      margin-bottom: 0.75rem;
    }
    .demo-buttons-stack {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .btn-demo-account {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      width: 100%;
      text-align: left;
      padding: 0.65rem 0.85rem;
      background: var(--nacs-surface);
      border: 1px solid var(--nacs-border);
      border-radius: var(--radius-xs);
      cursor: pointer;
      color: var(--nacs-text);
      transition: all 0.15s ease;

      &:hover:not(:disabled) {
        border-color: var(--nacs-primary);
        box-shadow: var(--elevation-1);
        transform: translateY(-1px);
      }
    }
    .demo-acc-icon {
      font-size: 1.25rem;
      line-height: 1.2;
      flex-shrink: 0;
      margin-top: 0.1rem;
    }
    .demo-acc-info {
      flex: 1;
      min-width: 0;
    }
    .demo-acc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.15rem;
    }
    .demo-acc-role {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--nacs-text);
    }
    .demo-acc-tag {
      font-size: 0.65rem;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-xs);
      text-transform: uppercase;
    }
    .tag-admin {
      background: rgba(217, 37, 80, 0.1);
      color: var(--nacs-danger);
    }
    .tag-lead {
      background: rgba(13, 13, 255, 0.1);
      color: var(--nacs-primary);
    }
    .tag-visitor {
      background: rgba(18, 140, 78, 0.1);
      color: var(--nacs-success);
    }
    .demo-acc-email {
      font-size: 0.75rem;
      color: var(--nacs-text-muted);
      font-family: monospace;
    }
    .demo-acc-route {
      font-size: 0.72rem;
      color: var(--nacs-primary);
      margin-top: 0.2rem;
    }

    /* --- Standard Auth Styles --- */
    .btn-google {
      width: 100%;
      background-color: var(--nacs-surface);
      color: var(--nacs-text);
      border: 1px solid var(--nacs-border-strong);
      padding: 0.75rem 1rem;
      font-weight: 600;
      font-size: 0.95rem;
      gap: 0.75rem;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--elevation-1);

      &:hover:not(:disabled) {
        background-color: var(--nacs-bg);
        border-color: var(--nacs-primary);
        box-shadow: var(--elevation-2);
      }
    }
    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      margin: 1.25rem 0;
      color: var(--nacs-text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;

      &::before, &::after {
        content: '';
        flex: 1;
        border-bottom: 1px solid var(--nacs-border);
      }
      span {
        padding: 0 0.75rem;
      }
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    .form-label {
      display: block;
      font-size: 0.825rem;
      font-weight: 600;
      margin-bottom: 0.35rem;
      color: var(--nacs-text);
    }
    .form-input {
      width: 100%;
      padding: 0.65rem 0.85rem;
      border: 1px solid var(--nacs-border-strong);
      border-radius: var(--radius-sm);
      font-size: 0.95rem;
      font-family: var(--font-body);
      background-color: var(--nacs-surface);
      color: var(--nacs-text);
      transition: border-color 0.15s ease;

      &:focus {
        outline: none;
        border-color: var(--nacs-primary);
        box-shadow: 0 0 0 2px rgba(13, 13, 255, 0.15);
      }
    }
    .btn-full {
      width: 100%;
      padding: 0.75rem;
      font-size: 0.95rem;
    }
    .auth-toggle {
      text-align: center;
      margin-top: 1.25rem;
    }
    .toggle-link {
      background: none;
      border: none;
      color: var(--nacs-primary);
      font-size: 0.85rem;
      cursor: pointer;
      font-weight: 500;
      text-decoration: underline;

      &:hover {
        color: var(--nacs-primary-dark);
      }
    }
    .alert-error {
      background-color: var(--nacs-danger-soft);
      color: var(--nacs-danger);
      border: 1px solid rgba(217, 37, 80, 0.3);
      padding: 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      margin-bottom: 1.25rem;
    }
  `],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isSignUpMode = signal<boolean>(false);

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  private get returnUrl(): string {
    return this.route.snapshot.queryParams['returnUrl'] || '/';
  }

  async onDemoLogin(role: 'admin' | 'board' | 'club_lead' | 'visitor', targetUrl: string): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      this.authService.loginAsDemo(role);
      await this.router.navigateByUrl(targetUrl);
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Failed to sign in with demo account.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onGoogleSignIn(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      await this.authService.signInWithGoogle();
      await this.router.navigateByUrl(this.returnUrl);
    } catch (err: any) {
      console.error('Google Sign In failed:', err);
      this.errorMessage.set(err.message || 'Failed to sign in with Google.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onEmailSubmit(): Promise<void> {
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.value;
    this.isLoading.set(true);
    this.errorMessage.set(null);

    try {
      if (this.isSignUpMode()) {
        await this.authService.signUpWithEmail(email!, password!);
      } else {
        await this.authService.signInWithEmail(email!, password!);
      }
      await this.router.navigateByUrl(this.returnUrl);
    } catch (err: any) {
      console.error('Email auth failed:', err);
      this.errorMessage.set(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      this.isLoading.set(false);
    }
  }
}

