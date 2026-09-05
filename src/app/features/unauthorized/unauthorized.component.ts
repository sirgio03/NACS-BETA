import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="unauthorized-container">
      <div class="card unauthorized-card">
        <div class="status-badge">
          <span class="badge badge-flagged">403 &mdash; Access Restricted</span>
        </div>

        <h1 class="h2">Restricted Clearance Required</h1>
        <p class="body-text text-muted">
          Your active federation account does not hold the necessary role credentials to access this view.
        </p>

        <div class="details-box">
          <div class="detail-row">
            <span class="detail-label">Your Current Role:</span>
            <span class="badge badge-accent">{{ currentRole | uppercase }}</span>
          </div>
          @if (requiredRoles) {
            <div class="detail-row">
              <span class="detail-label">Required Role(s):</span>
              <span class="text-small font-bold">{{ requiredRoles | uppercase }}</span>
            </div>
          }
        </div>

        <div class="actions">
          <a routerLink="/" class="btn btn-primary">Return to Federation Directory</a>
          @if (authService.isAuthenticated()) {
            <button type="button" (click)="authService.signOut()" class="btn btn-outline">
              Sign Out / Switch Account
            </button>
          } @else {
            <a routerLink="/auth/login" class="btn btn-outline">Sign In</a>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .unauthorized-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 50vh;
      padding: 1.5rem;
    }
    .unauthorized-card {
      max-width: 540px;
      width: 100%;
      text-align: center;
      padding: 2.5rem;
    }
    .status-badge {
      margin-bottom: 1.25rem;
    }
    .details-box {
      background-color: var(--nacs-bg);
      border: 1px solid var(--nacs-border);
      border-radius: var(--radius-sm);
      padding: 1.25rem;
      margin: 1.75rem 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
    }
    .detail-label {
      color: var(--nacs-text-muted);
      font-weight: 500;
    }
    .actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
      flex-wrap: wrap;
    }
  `],
})
export class UnauthorizedComponent {
  readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  get currentRole(): string {
    return this.route.snapshot.queryParams['current'] || this.authService.userRole();
  }

  get requiredRoles(): string {
    return this.route.snapshot.queryParams['required'] || '';
  }
}
