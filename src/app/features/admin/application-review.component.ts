import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ApplicationService,
  ApplicationStats,
} from '../../core/services/application.service';
import { ClubApplication, ApplicationStatus } from '../../core/models/application.model';

@Component({
  selector: 'app-application-review',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './application-review.component.html',
  styleUrl: './application-review.component.scss',
})
export class ApplicationReviewComponent implements OnInit {
  private readonly applicationService = inject(ApplicationService);

  // --- State Signals ---
  readonly applications = signal<ClubApplication[]>([]);
  readonly stats = signal<ApplicationStats>({ pending: 0, approved: 0, rejected: 0, total: 0 });
  readonly isLoading = signal<boolean>(true);
  readonly isSubmittingAction = signal<boolean>(false);
  readonly actionFeedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active filter tab
  activeTab: ApplicationStatus | 'all' = 'pending';

  // Selected application for detail modal
  selectedApplication = signal<ClubApplication | null>(null);

  // Rejection modal state
  rejectionTarget = signal<ClubApplication | null>(null);
  rejectionReason = '';

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    this.actionFeedback.set(null);
    try {
      const [appsList, statsData] = await Promise.all([
        this.applicationService.getApplications(this.activeTab),
        this.applicationService.getApplicationStats(),
      ]);
      this.applications.set(appsList);
      this.stats.set(statsData);
    } catch (err: any) {
      console.error('[ApplicationReview] Error loading applications:', err);
      this.actionFeedback.set({
        type: 'error',
        message: 'Failed to load applications. Ensure you have board/admin privileges.',
      });
    } finally {
      this.isLoading.set(false);
    }
  }

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

  openRejectModal(app: ClubApplication): void {
    this.rejectionTarget.set(app);
    this.rejectionReason = '';
  }

  closeRejectModal(): void {
    this.rejectionTarget.set(null);
    this.rejectionReason = '';
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
      console.error('Approval failed:', err);
      this.actionFeedback.set({
        type: 'error',
        message: err.message || 'Failed to approve application.',
      });
    } finally {
      this.isSubmittingAction.set(false);
    }
  }

  async onConfirmReject(): Promise<void> {
    const target = this.rejectionTarget();
    if (!target?.id || !this.rejectionReason.trim() || this.isSubmittingAction()) return;

    this.isSubmittingAction.set(true);
    this.actionFeedback.set(null);

    try {
      await this.applicationService.rejectApplication(target.id, this.rejectionReason);
      this.actionFeedback.set({
        type: 'success',
        message: `Application for "${target.clubName}" marked as rejected. Decision logged.`,
      });
      this.closeRejectModal();
      this.closeDetailModal();
      await this.loadData();
    } catch (err: any) {
      console.error('Rejection failed:', err);
      this.actionFeedback.set({
        type: 'error',
        message: err.message || 'Failed to reject application.',
      });
    } finally {
      this.isSubmittingAction.set(false);
    }
  }
}
