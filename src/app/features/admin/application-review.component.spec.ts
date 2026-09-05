import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApplicationReviewComponent } from './application-review.component';
import { ApplicationService } from '../../core/services/application.service';
import { ModerationService } from '../../core/services/moderation.service';
import { ClubApplication } from '../../core/models/application.model';
import { ClubEvent } from '../../core/models/event.model';
import { StudentProject } from '../../core/models/project.model';

describe('ApplicationReviewComponent', () => {
  let component: ApplicationReviewComponent;
  let fixture: ComponentFixture<ApplicationReviewComponent>;
  let mockApplicationService: jasmine.SpyObj<ApplicationService>;
  let mockModerationService: jasmine.SpyObj<ModerationService>;

  const mockPendingApp: ClubApplication = {
    id: 'app_test_1',
    clubName: 'Tech Innovators',
    university: 'USTHB',
    contactEmail: 'tech@usthb.dz',
    status: 'pending',
    submittedData: {
      category: 'tech',
      leadName: 'Amine Benali',
      description: 'A student society focused on open-source software and robotics.',
      foundingDate: '2023-01-01',
      motivation: 'Federate with national clubs.',
    },
    createdAt: new Date(),
  };

  const mockPendingEvent: ClubEvent = {
    id: 'event_flagged_1',
    clubId: 'club_alpha',
    clubName: 'Alpha Robotics',
    title: 'National Hackathon 2026',
    date: '2026-11-01T09:00:00.000Z',
    endDate: '2026-11-01T18:00:00.000Z',
    location: 'USTHB Campus',
    type: 'hackathon',
    description: '48h hackathon on AI and sustainability.',
    status: 'flagged_conflict',
    conflictContext: 'Potential schedule clash with approved event on 2026-11-02 (+/- 3 days).',
    createdBy: 'lead_uid_1',
    createdAt: new Date(),
  };

  const mockPendingProject: StudentProject = {
    id: 'proj_test_1',
    clubId: 'club_alpha',
    clubName: 'Alpha Robotics',
    title: 'Solar Lidar Rover',
    team: ['Yacine M.', 'Lina B.'],
    description: 'Autonomous planetary exploration rover prototype.',
    tags: ['robotics', 'lidar'],
    imageUrls: [],
    links: { github: 'https://github.com/rover' },
    status: 'pending',
    submittedBy: 'lead_uid_1',
    submittedAt: new Date(),
  };

  beforeEach(async () => {
    mockApplicationService = jasmine.createSpyObj('ApplicationService', [
      'getApplications',
      'getApplicationStats',
      'approveApplication',
      'rejectApplication',
    ]);

    mockModerationService = jasmine.createSpyObj('ModerationService', [
      'getPendingEvents',
      'approveEvent',
      'rejectEvent',
      'getPendingProjects',
      'approveProject',
      'rejectProject',
    ]);

    mockApplicationService.getApplications.and.resolveTo([mockPendingApp]);
    mockApplicationService.getApplicationStats.and.resolveTo({
      pending: 1,
      approved: 0,
      rejected: 0,
      total: 1,
    });
    mockModerationService.getPendingEvents.and.resolveTo([mockPendingEvent]);
    mockModerationService.getPendingProjects.and.resolveTo([mockPendingProject]);

    await TestBed.configureTestingModule({
      imports: [ApplicationReviewComponent],
      providers: [
        provideRouter([]),
        { provide: ApplicationService, useValue: mockApplicationService },
        { provide: ModerationService, useValue: mockModerationService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApplicationReviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load pending applications and stats on init', async () => {
    await fixture.whenStable();
    expect(mockApplicationService.getApplications).toHaveBeenCalledWith('pending');
    expect(mockApplicationService.getApplicationStats).toHaveBeenCalled();
    expect(component.applications().length).toBe(1);
    expect(component.stats().pending).toBe(1);
  });

  it('should open rejection modal and set target', () => {
    component.openRejectModal('application', mockPendingApp.id!, mockPendingApp.clubName);
    expect(component.rejectionTarget()).toEqual({
      type: 'application',
      id: 'app_test_1',
      title: 'Tech Innovators',
    });
    expect(component.rejectionReason).toBe('');
  });

  it('should not call rejectApplication if reason is whitespace only', async () => {
    component.openRejectModal('application', mockPendingApp.id!, mockPendingApp.clubName);
    component.rejectionReason = '   ';
    await component.onConfirmReject();
    expect(mockApplicationService.rejectApplication).not.toHaveBeenCalled();
  });

  it('should call rejectApplication with trimmed reason when confirmed', async () => {
    mockApplicationService.rejectApplication.and.resolveTo({
      success: true,
      message: 'Rejected',
      applicationId: 'app_test_1',
      reason: 'Proof invalid',
    });
    component.openRejectModal('application', mockPendingApp.id!, mockPendingApp.clubName);
    component.rejectionReason = 'Proof document does not match university records.';
    await component.onConfirmReject();
    expect(mockApplicationService.rejectApplication).toHaveBeenCalledWith(
      'app_test_1',
      'Proof document does not match university records.'
    );
  });

  it('should call approveApplication when onApprove is invoked', async () => {
    mockApplicationService.approveApplication.and.resolveTo({
      success: true,
      message: 'Approved',
      clubId: 'club_tech_1',
    });
    await component.onApprove(mockPendingApp);
    expect(mockApplicationService.approveApplication).toHaveBeenCalledWith('app_test_1');
  });

  it('should switch to events section and load pending events', async () => {
    await component.setSection('events');
    expect(component.activeSection()).toBe('events');
    expect(mockModerationService.getPendingEvents).toHaveBeenCalled();
    expect(component.pendingEvents().length).toBe(1);
  });

  it('should approve flagged conflict event when onApproveEvent is called', async () => {
    mockModerationService.approveEvent.and.resolveTo({
      success: true,
      message: 'Event approved',
    });
    await component.onApproveEvent(mockPendingEvent);
    expect(mockModerationService.approveEvent).toHaveBeenCalledWith('event_flagged_1');
  });

  it('should switch to projects section and approve project', async () => {
    await component.setSection('projects');
    expect(component.activeSection()).toBe('projects');
    expect(mockModerationService.getPendingProjects).toHaveBeenCalled();
    expect(component.pendingProjects().length).toBe(1);

    mockModerationService.approveProject.and.resolveTo({
      success: true,
      message: 'Project approved',
    });
    await component.onApproveProject(mockPendingProject);
    expect(mockModerationService.approveProject).toHaveBeenCalledWith('proj_test_1');
  });

  it('should reject event via unified rejection modal', async () => {
    mockModerationService.rejectEvent.and.resolveTo({
      success: true,
      message: 'Event rejected',
    });
    component.openRejectModal('event', mockPendingEvent.id!, mockPendingEvent.title);
    component.rejectionReason = 'Venue not certified for national scale.';
    await component.onConfirmReject();
    expect(mockModerationService.rejectEvent).toHaveBeenCalledWith(
      'event_flagged_1',
      'Venue not certified for national scale.'
    );
  });
});
