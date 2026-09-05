import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ClubService } from '../../core/services/club.service';
import { Club } from '../../core/models/club.model';

@Component({
  selector: 'app-club-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="profile-container">
      <!-- Breadcrumb Navigation -->
      <nav class="breadcrumb-nav" aria-label="Breadcrumb">
        <a routerLink="/clubs" class="back-link">&larr; Back to Club Directory</a>
      </nav>

      @if (isLoading()) {
        <!-- Skeleton Detail State -->
        <div class="card detail-skeleton">
          <div class="skeleton-header">
            <div class="skeleton skeleton-logo"></div>
            <div class="skeleton-info">
              <div class="skeleton skeleton-title"></div>
              <div class="skeleton skeleton-subtitle"></div>
            </div>
          </div>
          <div class="skeleton skeleton-body"></div>
          <div class="skeleton skeleton-body"></div>
        </div>
      } @else if (club()) {
        <!-- Institutional Club Profile -->
        <article class="profile-card card">
          <!-- Profile Header Banner -->
          <header class="profile-header">
            <div class="logo-box">
              @if (club()?.logoUrl) {
                <img
                  [src]="club()?.logoUrl"
                  [alt]="club()?.name + ' official emblem'"
                  class="profile-logo"
                />
              } @else {
                <div class="profile-logo-placeholder">
                  <span>{{ club()?.name?.substring(0, 2) | uppercase }}</span>
                </div>
              }
            </div>

            <div class="header-details">
              <div class="badges-row">
                <span class="badge badge-accent">{{ club()?.category | uppercase }}</span>
                @if (club()?.verified) {
                  <span class="badge badge-approved" title="Officially Verified by NACS Board">
                    &check; Verified Society
                  </span>
                } @else {
                  <span class="badge badge-pending">Pending Verification</span>
                }
              </div>

              <h1 class="h1 club-title">{{ club()?.name }}</h1>
              <p class="university-name font-medium text-muted">
                {{ club()?.university }}
              </p>

              @if (club()?.foundingDate) {
                <p class="text-small text-muted founding-date">
                  Founded: {{ club()?.foundingDate }}
                </p>
              }
            </div>
          </header>

          <div class="section-divider"></div>

          <!-- Description Section -->
          <section class="profile-section" aria-labelledby="about-heading">
            <h2 id="about-heading" class="h3">About the Society</h2>
            <p class="body-text">
              {{ club()?.description }}
            </p>
          </section>

          <!-- Leadership Section (Strict Privacy: Names & Roles ONLY; no email, no UID) -->
          <section class="profile-section" aria-labelledby="leadership-heading">
            <h2 id="leadership-heading" class="h3">Society Leadership</h2>
            <div class="leadership-grid">
              @for (leader of club()?.leadership; track leader.name) {
                <div class="leader-card">
                  <div class="leader-avatar">
                    <span>{{ leader.name.substring(0, 1) | uppercase }}</span>
                  </div>
                  <div class="leader-info">
                    <h3 class="leader-name font-bold">{{ leader.name }}</h3>
                    <p class="leader-role text-small text-muted">{{ leader.role }}</p>
                  </div>
                </div>
              }
            </div>
          </section>

          <!-- Social Links Section -->
          @if (hasSocials()) {
            <section class="profile-section" aria-labelledby="connect-heading">
              <h2 id="connect-heading" class="h3">Official Channels</h2>
              <div class="social-links-row">
                @if (club()?.socials?.website) {
                  <a [href]="club()?.socials?.website" target="_blank" rel="noopener noreferrer" class="social-btn">
                    &#127760; Website
                  </a>
                }
                @if (club()?.socials?.github) {
                  <a [href]="club()?.socials?.github" target="_blank" rel="noopener noreferrer" class="social-btn">
                    GitHub
                  </a>
                }
                @if (club()?.socials?.linkedin) {
                  <a [href]="club()?.socials?.linkedin" target="_blank" rel="noopener noreferrer" class="social-btn">
                    LinkedIn
                  </a>
                }
                @if (club()?.socials?.facebook) {
                  <a [href]="club()?.socials?.facebook" target="_blank" rel="noopener noreferrer" class="social-btn">
                    Facebook
                  </a>
                }
                @if (club()?.socials?.instagram) {
                  <a [href]="club()?.socials?.instagram" target="_blank" rel="noopener noreferrer" class="social-btn">
                    Instagram
                  </a>
                }
              </div>
            </section>
          }
        </article>
      } @else {
        <!-- Not Found State -->
        <div class="card not-found-card">
          <h2 class="h2">Club Profile Not Found</h2>
          <p class="body-text text-muted">
            The requested student society does not exist or may be unverified.
          </p>
          <div class="empty-actions">
            <a routerLink="/clubs" class="btn btn-primary">Return to Directory</a>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .profile-container {
      max-width: 960px;
      margin: 0 auto;
    }
    .breadcrumb-nav {
      margin-bottom: 1.5rem;
    }
    .back-link {
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--nacs-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
    .profile-card {
      padding: 2.5rem;
      background: var(--nacs-surface);
      border: 1px solid var(--nacs-border);
      border-radius: var(--radius-md);
      box-shadow: var(--elevation-1);
    }
    .profile-header {
      display: flex;
      gap: 2rem;
      align-items: flex-start;
      flex-wrap: wrap;
    }
    .logo-box {
      flex-shrink: 0;

      .profile-logo {
        width: 104px;
        height: 104px;
        border-radius: var(--radius-md);
        object-fit: cover;
        border: 2px solid var(--nacs-border);
      }

      .profile-logo-placeholder {
        width: 104px;
        height: 104px;
        border-radius: var(--radius-md);
        background-color: var(--nacs-primary);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--font-display);
        font-weight: 700;
        font-size: 2.5rem;
      }
    }
    .header-details {
      flex: 1;
      min-width: 280px;

      .badges-row {
        display: flex;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }
      .club-title {
        margin: 0.25rem 0;
      }
      .university-name {
        margin: 0 0 0.5rem 0;
        font-size: 1.05rem;
      }
      .founding-date {
        margin: 0;
      }
    }
    .profile-section {
      margin: 2rem 0;

      .h3 {
        border-bottom: 1px solid var(--nacs-border);
        padding-bottom: 0.5rem;
        margin-bottom: 1rem;
      }
    }
    .leadership-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1rem;
    }
    .leader-card {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.85rem 1rem;
      background-color: var(--nacs-bg);
      border: 1px solid var(--nacs-border);
      border-radius: var(--radius-sm);
    }
    .leader-avatar {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      background-color: var(--nacs-primary-soft);
      color: var(--nacs-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.1rem;
    }
    .leader-name {
      margin: 0;
      font-size: 0.95rem;
    }
    .leader-role {
      margin: 0;
    }
    .social-links-row {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .social-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      background-color: var(--nacs-bg);
      border: 1px solid var(--nacs-border-strong);
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--nacs-text);
      text-decoration: none;

      &:hover {
        background-color: var(--nacs-primary-soft);
        border-color: var(--nacs-primary);
        color: var(--nacs-primary);
        text-decoration: none;
      }
    }
    .not-found-card {
      text-align: center;
      padding: 4rem 2rem;
    }
    .detail-skeleton {
      padding: 2.5rem;
    }
    .skeleton-header {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .skeleton-logo {
      width: 104px;
      height: 104px;
      border-radius: var(--radius-md);
    }
    .skeleton-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .skeleton-title {
      width: 60%;
      height: 32px;
    }
    .skeleton-subtitle {
      width: 40%;
      height: 20px;
    }
    .skeleton-body {
      width: 100%;
      height: 16px;
      margin-bottom: 0.75rem;
    }
    .skeleton {
      background: linear-gradient(90deg, #eceef5 25%, #f7f7fc 50%, #eceef5 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: var(--radius-xs);
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class ClubDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly clubService = inject(ClubService);

  readonly club = signal<Club | null>(null);
  readonly isLoading = signal<boolean>(true);

  ngOnInit(): void {
    const clubId = this.route.snapshot.paramMap.get('id');
    if (clubId) {
      this.loadClub(clubId);
    } else {
      this.isLoading.set(false);
    }
  }

  async loadClub(id: string): Promise<void> {
    this.isLoading.set(true);
    try {
      const data = await this.clubService.getClubById(id);
      this.club.set(data);
    } catch (err) {
      console.error('[ClubDetail] Error loading club:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  hasSocials(): boolean {
    const socials = this.club()?.socials;
    if (!socials) return false;
    return !!(
      socials.website ||
      socials.github ||
      socials.linkedin ||
      socials.facebook ||
      socials.instagram
    );
  }
}
