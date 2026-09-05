import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ApplicationService,
  ApplicationStats,
} from '../../core/services/application.service';
import { ModerationService } from '../../core/services/moderation.service';
import { ClubApplication, ApplicationStatus } from '../../core/models/application.model';
import { ClubEvent } from '../../core/models/event.model';
import { StudentProject } from '../../core/models/project.model';

export type AdminSection = 'applications' | 'events' | 'projects';

@Component({
  selector: 'app-application-review',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './application-review.component.html',
  styleUrl: './application-review.component.scss',
})
export class ApplicationReviewComponent implements OnInit {
  private readonly applicationService = inject(ApplicationService);
  private readonly moderationService = inject(ModerationService);

  // Active top-level section
  activeSection = signal<AdminSection>('applications');

  // --- Applications Queue State ---
  readonly applications = signal<ClubApplication[]>([]);
  readonly stats = signal<ApplicationStats>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  activeTab: ApplicationStatus | 'all' = 'pending';
  selectedApplication = signal<ClubApplication | null>(null);

  // --- Events Moderation State ---
  readonly pendingEvents = signal<ClubEvent[]>([]);

  // --- Projects Moderation State ---
  readonly pendingProjects = signal<StudentProject[]>([]);
  selectedProject = signal<StudentProject | null>(null);

  // --- Global Loading & Action State ---
  readonly isLoading = signal<boolean>(true);
  readonly isSubmittingAction = signal<boolean>(false);
  readonly actionFeedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Unified Rejection Modal State ---
  readonly rejectionTarget = signal<{
    type: 'application' | 'event' | 'project';
    id: string;
    title: string;
  } | null>(null);
  rejectionReason = '';

  ngOnInit(): void {
    this.loadData();
  }

  async setSection(section: AdminSection): Promise<void> {
    this.activeSection.set(section);
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    this.actionFeedback.set(null);

    try {
      if (this.activeSection() === 'applications') {
        const [appsList, statsData] = await Promise.all([
          this.applicationService.getApplications(this.activeTab),
          this.applicationService.getApplicationStats(),
        ]);
        this.applications.set(appsList);
        this.stats.set(statsData);
      } else if (this.activeSection() === 'events') {
        const eventsList = await this.moderationService.getPendingEvents();
        this.pendingEvents.set(eventsList);
      } else if (this.activeSection() === 'projects') {
        const projectsList = await this.moderationService.getPendingProjects();
        this.pendingProjects.set(projectsList);
      }
    } catch (err: any) {
      console.error('[ApplicationReview] Error loading section data:', err);
      this.actionFeedback.set({
        type: 'error',
        message: 'Failed to load moderation data. Verify board/admin privileges.',
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Application Actions ---
  onTabChange(tab: ApplicationStatus | 'all'): void {
    this.activeTab = tab;
    this.loadData();
  }

  openDetailModal(app: ClubApplication): void {
    this.selectedApplication.set(app);
  }

  closeDetailModal(): void {
    this.selectedApplication.set(null);
  }

  async onApprove(app: ClubApplication): Promise<void> {
    if (!app.id || this.isSubmittingAction()) return;

    this.isSubmittingAction.set(true);
    this.actionFeedback.set(null);

    try {
      const result = await this.applicationService.approveApplication(app.id);
      this.actionFeedback.set({
        type: 'success',
        message: `Successfully approved "${app.clubName}". Club provisioned with ID ${result.clubId}.`,
      });
      this.closeDetailModal();
      await this.loadData();
    } catch (err: any) {
      console.error('Application approval failed:', err);
      this.actionFeedback.set({
        type: 'error',
        message: err.message || 'Failed to approve application.',
      });
    } finally {
      this.isSubmittingAction.set(false);
    }
  }

  // --- Event Moderation Actions ---
  async onApproveEvent(event: ClubEvent): Promise<void> {
    if (!event.id || this.isSubmittingAction()) return;

    this.isSubmittingAction.set(true);
    this.actionFeedback.set(null);

    try {
      await this.moderationService.approveEvent(event.id);
      this.actionFeedback.set({
        type: 'success',
        message: `Event "${event.title}" approved successfully.`,
      });
      await this.loadData();
    } catch (err: any) {
      console.error('Event approval failed:', err);
      this.actionFeedback.set({
        type: 'error',
        message: err.message || 'Failed to approve event.',
      });
    } finally {
      this.isSubmittingAction.set(false);
    }
  }

  // --- Project Moderation Actions ---
  openProjectDetail(project: StudentProject): void {
    this.selectedProject.set(project);
  }

  closeProjectDetail(): void {
    this.selectedProject.set(null);
  }

  async onApproveProject(project: StudentProject): Promise<void> {
    if (!project.id || this.isSubmittingAction()) return;

    this.isSubmittingAction.set(true);
    this.actionFeedback.set(null);

    try {
      await this.moderationService.approveProject(project.id);
      this.actionFeedback.set({
        type: 'success',
        message: `Project "${project.title}" approved for showcase gallery.`,
      });
      this.closeProjectDetail();
      await this.loadData();
    } catch (err: any) {
      console.error('Project approval failed:', err);
      this.actionFeedback.set({
        type: 'error',
        message: err.message || 'Failed to approve project.',
      });
    } finally {
      this.isSubmittingAction.set(false);
    }
  }

  // --- Unified Rejection Modal ---
  openRejectModal(type: 'application' | 'event' | 'project', id: string, title: string): void {
    this.rejectionTarget.set({ type, id, title });
    this.rejectionReason = '';
  }

  closeRejectModal(): void {
    this.rejectionTarget.set(null);
    this.rejectionReason = '';
  }

  async onConfirmReject(): Promise<void> {
    const target = this.rejectionTarget();
    if (!target?.id || !this.rejectionReason.trim() || this.isSubmittingAction()) return;

    this.isSubmittingAction.set(true);
    this.actionFeedback.set(null);

    try {
      if (target.type === 'application') {
        await this.applicationService.rejectApplication(target.id, this.rejectionReason);
        this.actionFeedback.set({
          type: 'success',
          message: `Application for "${target.title}" rejected. Decision logged.`,
        });
        this.closeDetailModal();
      } else if (target.type === 'event') {
        await this.moderationService.rejectEvent(target.id, this.rejectionReason);
        this.actionFeedback.set({
          type: 'success',
          message: `Event "${target.title}" rejected. Decision logged.`,
        });
      } else if (target.type === 'project') {
        await this.moderationService.rejectProject(target.id, this.rejectionReason);
        this.actionFeedback.set({
          type: 'success',
          message: `Project "${target.title}" rejected. Decision logged.`,
        });
        this.closeProjectDetail();
      }

      this.closeRejectModal();
      await this.loadData();
    } catch (err: any) {
      console.error('Rejection failed:', err);
      this.actionFeedback.set({
        type: 'error',
        message: err.message || 'Failed to reject item.',
      });
    } finally {
      this.isSubmittingAction.set(false);
    }
  }
}
