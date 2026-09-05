import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  ClubLeadService,
  SubmitEventRequest,
  SubmitProjectRequest,
} from '../../core/services/club-lead.service';
import { Club, ClubLeader } from '../../core/models/club.model';
import { ClubEvent, EventType } from '../../core/models/event.model';
import { StudentProject } from '../../core/models/project.model';

@Component({
  selector: 'app-lead-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DatePipe],
  templateUrl: './lead-dashboard.component.html',
  styleUrl: './lead-dashboard.component.scss',
})
export class LeadDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly clubLeadService = inject(ClubLeadService);

  // --- Active Tab ---
  activeTab: 'profile' | 'events' | 'projects' = 'profile';

  // --- Data Signals ---
  readonly myClub = signal<Club | null>(null);
  readonly myEvents = signal<ClubEvent[]>([]);
  readonly myProjects = signal<StudentProject[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isSaving = signal<boolean>(false);
  readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- Profile Form State ---
  description = '';
  logoUrl = '';
  socials = {
    website: '',
    github: '',
    linkedin: '',
    instagram: '',
    discord: '',
  };
  leadershipList: Array<{ name: string; role: string }> = [];

  // --- Event Submission Modal State ---
  showEventModal = signal<boolean>(false);
  eventForm = {
    title: '',
    date: '',
    endDate: '',
    location: '',
    type: 'workshop' as EventType,
    description: '',
  };

  // --- Project Submission Modal State ---
  showProjectModal = signal<boolean>(false);
  projectForm = {
    title: '',
    teamRaw: '',
    description: '',
    tagsRaw: '',
    imageUrlsRaw: '',
    github: '',
    demo: '',
  };

  get userClubId(): string | null {
    return this.authService.userProfile()?.clubId ?? null;
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  async loadAllData(): Promise<void> {
    const clubId = this.userClubId;
    if (!clubId) {
      this.isLoading.set(false);
      this.feedback.set({
        type: 'error',
        message: 'No associated club found for this lead account.',
      });
      return;
    }

    this.isLoading.set(true);
    this.feedback.set(null);

    try {
      const [clubData, eventsData, projectsData] = await Promise.all([
        this.clubLeadService.getMyClub(clubId),
        this.clubLeadService.getMyEvents(clubId),
        this.clubLeadService.getMyProjects(clubId),
      ]);

      if (clubData) {
        this.myClub.set(clubData);
        this.description = clubData.description || '';
        this.logoUrl = clubData.logoUrl || '';
        this.socials = {
          website: clubData.socials?.['website'] || '',
          github: clubData.socials?.['github'] || '',
          linkedin: clubData.socials?.['linkedin'] || '',
          instagram: clubData.socials?.['instagram'] || '',
          discord: clubData.socials?.['discord'] || '',
        };
        this.leadershipList = clubData.leadership
          ? clubData.leadership.map((l) => ({ name: l.name, role: l.role }))
          : [];
      }

      this.myEvents.set(eventsData);
      this.myProjects.set(projectsData);
    } catch (err: any) {
      console.error('[LeadDashboard] Failed to load club data:', err);
      this.feedback.set({
        type: 'error',
        message: 'Failed to load club workspace. Please ensure you are logged in.',
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  setTab(tab: 'profile' | 'events' | 'projects'): void {
    this.activeTab = tab;
    this.feedback.set(null);
  }

  // --- Profile Leadership Actions ---
  addLeaderMember(): void {
    this.leadershipList.push({ name: '', role: 'Executive Member' });
  }

  removeLeaderMember(index: number): void {
    this.leadershipList.splice(index, 1);
  }

  async onSaveProfile(): Promise<void> {
    const clubId = this.userClubId;
    if (!clubId || this.isSaving()) return;

    this.isSaving.set(true);
    this.feedback.set(null);

    // Filter valid leadership items (name & role required, strip whitespace)
    const sanitizedLeadership: ClubLeader[] = this.leadershipList
      .filter((m) => m.name.trim().length > 0 && m.role.trim().length > 0)
      .map((m) => ({ name: m.name.trim(), role: m.role.trim() }));

    try {
      await this.clubLeadService.updateClubProfile({
        clubId,
        description: this.description.trim(),
        logoUrl: this.logoUrl.trim(),
        socials: {
          website: this.socials.website.trim(),
          github: this.socials.github.trim(),
          linkedin: this.socials.linkedin.trim(),
          instagram: this.socials.instagram.trim(),
          discord: this.socials.discord.trim(),
        },
        leadership: sanitizedLeadership,
      });

      this.feedback.set({
        type: 'success',
        message: 'Club profile updated successfully.',
      });

      const updated = await this.clubLeadService.getMyClub(clubId);
      if (updated) this.myClub.set(updated);
    } catch (err: any) {
      console.error('[LeadDashboard] Update error:', err);
      this.feedback.set({
        type: 'error',
        message: err.message || 'Failed to update club profile.',
      });
    } finally {
      this.isSaving.set(false);
    }
  }

  // --- Event Modal & Submission ---
  openEventModal(): void {
    this.eventForm = {
      title: '',
      date: '',
      endDate: '',
      location: '',
      type: 'workshop',
      description: '',
    };
    this.showEventModal.set(true);
  }

  closeEventModal(): void {
    this.showEventModal.set(false);
  }

  async onSubmitEvent(): Promise<void> {
    const clubId = this.userClubId;
    if (!clubId || this.isSaving()) return;

    if (!this.eventForm.title.trim() || !this.eventForm.date || !this.eventForm.endDate) {
      this.feedback.set({
        type: 'error',
        message: 'Please provide event title, start date, and end date.',
      });
      return;
    }

    this.isSaving.set(true);
    this.feedback.set(null);

    try {
      const payload: SubmitEventRequest = {
        clubId,
        title: this.eventForm.title.trim(),
        date: new Date(this.eventForm.date).toISOString(),
        endDate: new Date(this.eventForm.endDate).toISOString(),
        location: this.eventForm.location.trim() || 'Online / Campus',
        type: this.eventForm.type,
        description: this.eventForm.description.trim(),
      };

      const res = await this.clubLeadService.submitEvent(payload);

      if (res.status === 'flagged_conflict') {
        this.feedback.set({
          type: 'error',
          message: `Event submitted! Warning: A date conflict was detected with a nearby approved national event. Your event has been flagged and queued for board moderation.`,
        });
      } else {
        this.feedback.set({
          type: 'success',
          message: 'Event submitted successfully and is pending board review.',
        });
      }

      this.closeEventModal();
      const updatedEvents = await this.clubLeadService.getMyEvents(clubId);
      this.myEvents.set(updatedEvents);
      this.activeTab = 'events';
    } catch (err: any) {
      console.error('[LeadDashboard] Submit event error:', err);
      this.feedback.set({
        type: 'error',
        message: err.message || 'Failed to submit event.',
      });
    } finally {
      this.isSaving.set(false);
    }
  }

  // --- Project Modal & Submission ---
  openProjectModal(): void {
    this.projectForm = {
      title: '',
      teamRaw: '',
      description: '',
      tagsRaw: '',
      imageUrlsRaw: '',
      github: '',
      demo: '',
    };
    this.showProjectModal.set(true);
  }

  closeProjectModal(): void {
    this.showProjectModal.set(false);
  }

  async onSubmitProject(): Promise<void> {
    const clubId = this.userClubId;
    if (!clubId || this.isSaving()) return;

    if (!this.projectForm.title.trim() || !this.projectForm.description.trim() || !this.projectForm.teamRaw.trim()) {
      this.feedback.set({
        type: 'error',
        message: 'Project title, student team members, and description are required.',
      });
      return;
    }

    this.isSaving.set(true);
    this.feedback.set(null);

    try {
      const team = this.projectForm.teamRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const tags = this.projectForm.tagsRaw
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      const imageUrls = this.projectForm.imageUrlsRaw
        .split('\n')
        .map((url) => url.trim())
        .filter(Boolean);

      const payload: SubmitProjectRequest = {
        clubId,
        title: this.projectForm.title.trim(),
        team,
        description: this.projectForm.description.trim(),
        tags,
        imageUrls,
        links: {
          github: this.projectForm.github.trim() || undefined,
          demo: this.projectForm.demo.trim() || undefined,
        },
      };

      await this.clubLeadService.submitProject(payload);

      this.feedback.set({
        type: 'success',
        message: 'Project submitted successfully for national showcase approval.',
      });

      this.closeProjectModal();
      const updatedProjects = await this.clubLeadService.getMyProjects(clubId);
      this.myProjects.set(updatedProjects);
      this.activeTab = 'projects';
    } catch (err: any) {
      console.error('[LeadDashboard] Submit project error:', err);
      this.feedback.set({
        type: 'error',
        message: err.message || 'Failed to submit project.',
      });
    } finally {
      this.isSaving.set(false);
    }
  }
}
