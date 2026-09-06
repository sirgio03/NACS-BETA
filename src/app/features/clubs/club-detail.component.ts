import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ClubService } from '../../core/services/club.service';
import { CalendarService } from '../../core/services/calendar.service';
import { ShowcaseService } from '../../core/services/showcase.service';
import { Club } from '../../core/models/club.model';
import { ClubEvent } from '../../core/models/event.model';
import { StudentProject } from '../../core/models/project.model';

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
              @if (club()?.logoUrl && !logoError()) {
                <img
                  [src]="club()?.logoUrl"
                  [alt]="club()?.name + ' official emblem'"
                  class="profile-logo"
                  (error)="onLogoError()"
                />
              } @else {
                <div class="profile-logo-placeholder">
                  <span>{{ (club()?.name || 'DZ').substring(0, 2) | uppercase }}</span>
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
                <div class="founding-badge">
                  <span class="calendar-icon" aria-hidden="true">&#128197;</span>
                  <span>Founded: <strong>{{ club()?.foundingDate }}</strong></span>
                </div>
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

          <!-- Society Events Section -->
          <section class="profile-section" aria-labelledby="events-heading">
            <div class="section-header-row">
              <div>
                <h2 id="events-heading" class="h3">Society Events & Activities</h2>
                <p class="text-small text-muted">Upcoming workshops, hackathons, and conferences organized by this society.</p>
              </div>
              <a routerLink="/calendar" class="section-action-link">
                View National Calendar &rarr;
              </a>
            </div>

            @if (clubEvents().length > 0) {
              <div class="events-grid">
                @for (event of clubEvents(); track event.id || event.title) {
                  <div class="event-card">
                    <div class="event-top-row">
                      <span class="badge badge-accent">{{ event.type | uppercase }}</span>
                      @if (event.wilaya) {
                        <span class="event-wilaya-badge">{{ event.wilaya }}</span>
                      }
                      @if (event.conflictContext) {
                        <span class="badge badge-conflict" [title]="event.conflictContext">
                          &excl; Flagged Clash
                        </span>
                      }
                    </div>

                    <h3 class="event-title font-bold">{{ event.title }}</h3>

                    <div class="event-meta-row">
                      <span class="event-meta-item">
                        &#128197; {{ formatEventDate(event.date) }}
                      </span>
                      @if (event.location) {
                        <span class="event-meta-item">
                          &#128205; {{ event.location }}
                        </span>
                      }
                    </div>

                    <p class="event-description text-small text-muted">
                      {{ event.description }}
                    </p>

                    <div class="event-actions-row">
                      <button
                        type="button"
                        class="btn-ics-export"
                        [disabled]="isExportingIcs() === event.id"
                        (click)="downloadEventIcs(event)"
                      >
                        @if (isExportingIcs() === event.id) {
                          Exporting...
                        } @else {
                          &#128197; Add to Calendar (.ics)
                        }
                      </button>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-sub-card">
                <p class="text-muted">No public events currently scheduled for this society.</p>
                <a routerLink="/calendar" class="empty-link">Browse National Events Calendar</a>
              </div>
            }
          </section>

          <!-- Showcase Projects Section -->
          <section class="profile-section" aria-labelledby="projects-heading">
            <div class="section-header-row">
              <div>
                <h2 id="projects-heading" class="h3">Showcase Projects</h2>
                <p class="text-small text-muted">Engineering innovations and open source projects built by club members.</p>
              </div>
              <a routerLink="/showcase" class="section-action-link">
                View All Projects &rarr;
              </a>
            </div>

            @if (clubProjects().length > 0) {
              <div class="projects-grid">
                @for (project of clubProjects(); track project.id || project.title) {
                  <div class="project-card">
                    <h3 class="project-title font-bold">{{ project.title }}</h3>

                    @if (project.tags && project.tags.length > 0) {
                      <div class="project-tags-row">
                        @for (tag of project.tags; track tag) {
                          <span class="project-tag">#{{ tag }}</span>
                        }
                      </div>
                    }

                    <p class="project-desc text-small text-muted">
                      {{ project.description }}
                    </p>

                    @if (project.team && project.team.length > 0) {
                      <div class="project-team-row">
                        <span class="team-label">Team:</span>
                        <span class="team-names">{{ project.team.join(', ') }}</span>
                      </div>
                    }

                    <div class="project-links-row">
                      @if (project.links.github) {
                        <a [href]="project.links.github" target="_blank" rel="noopener noreferrer" class="link-btn">
                          GitHub
                        </a>
                      }
                      @if (project.links.demo) {
                        <a [href]="project.links.demo" target="_blank" rel="noopener noreferrer" class="link-btn">
                          Live Demo
                        </a>
                      }
                      @if (project.links.paper) {
                        <a [href]="project.links.paper" target="_blank" rel="noopener noreferrer" class="link-btn">
                          Paper / Docs
                        </a>
                      }
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="empty-sub-card">
                <p class="text-muted">No showcase projects published yet by this society.</p>
                <a routerLink="/showcase" class="empty-link">Explore National Project Showcase</a>
              </div>
            }
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
      padding-bottom: 3rem;
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
        background-color: var(--nacs-bg);
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
        flex-wrap: wrap;
      }
      .club-title {
        margin: 0.25rem 0;
      }
      .university-name {
        margin: 0 0 0.5rem 0;
        font-size: 1.05rem;
      }
      .founding-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.25rem 0.6rem;
        background-color: var(--nacs-bg);
        border: 1px solid var(--nacs-border);
        border-radius: var(--radius-sm);
        font-size: 0.85rem;
        color: var(--nacs-text);
        margin-top: 0.25rem;

        .calendar-icon {
          font-size: 0.9rem;
        }
      }
    }
    .section-divider {
      height: 1px;
      background-color: var(--nacs-border);
      margin: 2rem 0;
    }
    .profile-section {
      margin: 2.5rem 0;

      .h3 {
        margin-bottom: 0.25rem;
      }
    }
    .section-header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 1.25rem;
      border-bottom: 1px solid var(--nacs-border);
      padding-bottom: 0.75rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .section-action-link {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--nacs-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    /* Events Styling */
    .events-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.25rem;
    }
    .event-card {
      padding: 1.25rem;
      background-color: var(--nacs-bg);
      border: 1px solid var(--nacs-border);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      transition: transform 0.15s ease, box-shadow 0.15s ease;

      &:hover {
        border-color: var(--nacs-primary-soft);
        box-shadow: var(--elevation-1);
      }
    }
    .event-top-row {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
      align-items: center;
    }
    .event-wilaya-badge {
      font-size: 0.75rem;
      font-weight: 500;
      padding: 0.15rem 0.4rem;
      background-color: var(--nacs-surface);
      border: 1px solid var(--nacs-border);
      border-radius: var(--radius-xs);
      color: var(--nacs-text-muted);
    }
    .badge-conflict {
      background-color: #fffbeb;
      color: #92400e;
      border: 1px solid #fcd34d;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.15rem 0.45rem;
      border-radius: var(--radius-xs);
    }
    .event-title {
      font-size: 1.05rem;
      margin: 0.2rem 0;
      color: var(--nacs-text);
    }
    .event-meta-row {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.82rem;
      color: var(--nacs-text-muted);
    }
    .event-description {
      font-size: 0.85rem;
      line-height: 1.45;
      margin: 0.25rem 0 0.5rem 0;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .event-actions-row {
      margin-top: auto;
      padding-top: 0.5rem;
    }
    .btn-ics-export {
      width: 100%;
      padding: 0.45rem 0.8rem;
      font-size: 0.8rem;
      font-weight: 600;
      background-color: var(--nacs-surface);
      border: 1px solid var(--nacs-border-strong);
      border-radius: var(--radius-xs);
      color: var(--nacs-text);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;

      &:hover:not(:disabled) {
        background-color: var(--nacs-primary-soft);
        border-color: var(--nacs-primary);
        color: var(--nacs-primary);
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    /* Projects Styling */
    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.25rem;
    }
    .project-card {
      padding: 1.25rem;
      background-color: var(--nacs-bg);
      border: 1px solid var(--nacs-border);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .project-title {
      font-size: 1.05rem;
      margin: 0;
      color: var(--nacs-text);
    }
    .project-tags-row {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
    }
    .project-tag {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.1rem 0.35rem;
      background-color: var(--nacs-surface);
      border: 1px solid var(--nacs-border);
      border-radius: var(--radius-xs);
      color: var(--nacs-primary);
    }
    .project-desc {
      font-size: 0.85rem;
      line-height: 1.45;
      margin: 0.2rem 0;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .project-team-row {
      font-size: 0.78rem;
      color: var(--nacs-text-muted);
      .team-label {
        font-weight: 600;
        margin-right: 0.3rem;
      }
    }
    .project-links-row {
      display: flex;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 0.5rem;
    }
    .link-btn {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--nacs-primary);
      text-decoration: none;
      padding: 0.25rem 0.5rem;
      background-color: var(--nacs-surface);
      border: 1px solid var(--nacs-border);
      border-radius: var(--radius-xs);

      &:hover {
        background-color: var(--nacs-primary-soft);
      }
    }

    .empty-sub-card {
      padding: 2rem 1.5rem;
      background-color: var(--nacs-bg);
      border: 1px dashed var(--nacs-border-strong);
      border-radius: var(--radius-sm);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }
    .empty-link {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--nacs-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    /* Leadership Styling */
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
  private readonly calendarService = inject(CalendarService);
  private readonly showcaseService = inject(ShowcaseService);

  readonly club = signal<Club | null>(null);
  readonly clubEvents = signal<ClubEvent[]>([]);
  readonly clubProjects = signal<StudentProject[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly logoError = signal<boolean>(false);
  readonly isExportingIcs = signal<string | null>(null);

  ngOnInit(): void {
    const clubId = this.route.snapshot.paramMap.get('id');
    if (clubId) {
      this.loadClub(clubId);
      this.loadClubEvents(clubId);
      this.loadClubProjects(clubId);
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

  async loadClubEvents(clubId: string): Promise<void> {
    try {
      const events = await this.calendarService.getApprovedEventsByClub(clubId);
      this.clubEvents.set(events);
    } catch (err) {
      console.error('[ClubDetail] Error loading club events:', err);
    }
  }

  async loadClubProjects(clubId: string): Promise<void> {
    try {
      const result = await this.showcaseService.getApprovedProjects({ clubId });
      this.clubProjects.set(result.projects);
    } catch (err) {
      console.error('[ClubDetail] Error loading club projects:', err);
    }
  }

  async downloadEventIcs(event: ClubEvent): Promise<void> {
    if (!event.id) return;
    this.isExportingIcs.set(event.id);
    try {
      await this.calendarService.downloadEventIcs(event.id, event.title);
    } catch (err) {
      console.error('[ClubDetail] Error downloading ICS:', err);
    } finally {
      this.isExportingIcs.set(null);
    }
  }

  onLogoError(): void {
    this.logoError.set(true);
  }

  formatEventDate(iso: string): string {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
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
