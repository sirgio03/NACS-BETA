import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="foundation-card card">
      <div class="header-badge">
        <span class="badge badge-approved">Phase 1: Architecture Foundation</span>
      </div>

      <h1 class="h1">National Association of Campus Societies</h1>
      <p class="body-text text-muted">
        Algerian University Club Federation Platform — Connecting student societies across technology, science, and culture.
      </p>

      <div class="section-divider"></div>

      <div class="status-grid">
        <div class="status-item">
          <span class="status-label">Environment Target</span>
          <span class="status-value font-bold">{{ envName }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Firestore Rules</span>
          <span class="status-value font-bold text-success">Strict Default-Deny Active</span>
        </div>
        <div class="status-item">
          <span class="status-label">App Check Protection</span>
          <span class="status-value font-bold text-accent">Configured (reCAPTCHA Enterprise)</span>
        </div>
        <div class="status-item">
          <span class="status-label">Typography System</span>
          <span class="status-value font-bold">Space Grotesk &amp; Inter (Bundled)</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .foundation-card {
      max-width: 800px;
      margin: 2rem auto;
      background: var(--nacs-surface);
      border: 1px solid var(--nacs-border);
      border-radius: var(--radius-md);
      padding: 2.5rem;
      box-shadow: var(--elevation-1);
    }
    .header-badge {
      margin-bottom: 1.25rem;
    }
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.5rem;
      margin-top: 1.5rem;
      background-color: var(--nacs-bg);
      padding: 1.25rem;
      border-radius: var(--radius-sm);
      border: 1px solid var(--nacs-border);
    }
    .status-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .status-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--nacs-text-muted);
      font-weight: 600;
    }
    .status-value {
      font-size: 0.95rem;
      color: var(--nacs-text);
    }
    .text-success {
      color: var(--nacs-success);
    }
    .text-accent {
      color: #996e00;
    }
  `],
})
export class HomeComponent {
  readonly envName = environment.environmentName.toUpperCase();
}
