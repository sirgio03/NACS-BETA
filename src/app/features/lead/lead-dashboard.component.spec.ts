import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { LeadDashboardComponent } from './lead-dashboard.component';
import { AuthService } from '../../core/services/auth.service';
import { ClubLeadService } from '../../core/services/club-lead.service';
import { Club } from '../../core/models/club.model';
import { ClubEvent } from '../../core/models/event.model';
import { StudentProject } from '../../core/models/project.model';

describe('LeadDashboardComponent', () => {
  let component: LeadDashboardComponent;
  let fixture: ComponentFixture<LeadDashboardComponent>;
  let mockAuthService: any;
  let mockClubLeadService: jasmine.SpyObj<ClubLeadService>;

  const mockClub: Club = {
    id: 'club_lead_1',
    name: 'Micro Club USTHB',
    university: 'USTHB',
    category: 'tech',
    foundingDate: '2020-01-01',
    verified: true,
    description: 'Leading computer science club at USTHB.',
    logoUrl: 'https://example.com/logo.png',
    socials: { website: 'https://microclub.dz' },
    leadership: [{ name: 'Amine Benali', role: 'President' }],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEvent: ClubEvent = {
    id: 'event_1',
    clubId: 'club_lead_1',
    title: 'Linux Install Party',
    date: '2026-10-10T09:00:00.000Z',
    endDate: '2026-10-10T17:00:00.000Z',
    location: 'USTHB Cyber Espace',
    type: 'workshop',
    description: 'Annual open source OS setup workshop.',
    status: 'pending',
    createdBy: 'lead_uid_1',
    createdAt: new Date(),
  };

  const mockProject: StudentProject = {
    id: 'proj_1',
    clubId: 'club_lead_1',
    title: 'Campus Food Delivery Bot',
    team: ['Yacine', 'Karim'],
    description: 'Autonomous indoor delivery robot for university campus.',
    tags: ['robotics', 'navigation'],
    imageUrls: [],
    links: { github: 'https://github.com/microclub/bot' },
    status: 'pending',
    submittedBy: 'lead_uid_1',
    submittedAt: new Date(),
  };

  beforeEach(async () => {
    mockAuthService = {
      currentUser: signal({ uid: 'lead_uid_1' }),
      userProfile: signal({
        uid: 'lead_uid_1',
        email: 'lead@usthb.dz',
        displayName: 'Amine Lead',
        role: 'club_lead',
        clubId: 'club_lead_1',
      }),
      loading: signal(false),
      isAuthenticated: signal(true),
      isClubLead: signal(true),
    };

    mockClubLeadService = jasmine.createSpyObj('ClubLeadService', [
      'getMyClub',
      'updateClubProfile',
      'getMyEvents',
      'submitEvent',
      'getMyProjects',
      'submitProject',
    ]);

    mockClubLeadService.getMyClub.and.returnValue(Promise.resolve(mockClub));
    mockClubLeadService.getMyEvents.and.returnValue(Promise.resolve([mockEvent]));
    mockClubLeadService.getMyProjects.and.returnValue(Promise.resolve([mockProject]));

    await TestBed.configureTestingModule({
      imports: [LeadDashboardComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ClubLeadService, useValue: mockClubLeadService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load club, events, and projects data on init', async () => {
    await fixture.whenStable();
    expect(mockClubLeadService.getMyClub).toHaveBeenCalledWith('club_lead_1');
    expect(mockClubLeadService.getMyEvents).toHaveBeenCalledWith('club_lead_1');
    expect(mockClubLeadService.getMyProjects).toHaveBeenCalledWith('club_lead_1');
    expect(component.myClub()?.name).toBe('Micro Club USTHB');
    expect(component.myEvents().length).toBe(1);
    expect(component.myProjects().length).toBe(1);
  });

  it('should switch active tabs', () => {
    expect(component.activeTab).toBe('profile');
    component.setTab('events');
    expect(component.activeTab).toBe('events');
    component.setTab('projects');
    expect(component.activeTab).toBe('projects');
  });

  it('should add and remove leadership members in profile editor', async () => {
    await fixture.whenStable();
    expect(component.leadershipList.length).toBe(1);
    component.addLeaderMember();
    expect(component.leadershipList.length).toBe(2);
    component.removeLeaderMember(1);
    expect(component.leadershipList.length).toBe(1);
  });

  it('should call updateClubProfile with allowlisted fields on save', async () => {
    mockClubLeadService.updateClubProfile.and.returnValue(
      Promise.resolve({ success: true, message: 'Updated' })
    );

    component.description = 'Updated description';
    await component.onSaveProfile();

    expect(mockClubLeadService.updateClubProfile).toHaveBeenCalledWith(
      jasmine.objectContaining({
        clubId: 'club_lead_1',
        description: 'Updated description',
      })
    );
  });

  it('should submit event and refresh events list', async () => {
    mockClubLeadService.submitEvent.and.returnValue(
      Promise.resolve({
        success: true,
        eventId: 'new_ev',
        status: 'pending',
        message: 'Submitted',
      })
    );

    component.openEventModal();
    component.eventForm = {
      title: 'DevFest Algiers',
      date: '2026-11-10T10:00',
      endDate: '2026-11-10T18:00',
      location: 'Auditorium',
      wilaya: '16 - Alger',
      type: 'conference',
      description: 'Annual developer conference.',
    };

    await component.onSubmitEvent();

    expect(mockClubLeadService.submitEvent).toHaveBeenCalled();
    expect(component.showEventModal()).toBeFalse();
  });

  it('should submit project and refresh projects list', async () => {
    mockClubLeadService.submitProject.and.returnValue(
      Promise.resolve({
        success: true,
        projectId: 'new_proj',
        status: 'pending',
        message: 'Submitted',
      })
    );

    component.openProjectModal();
    component.projectForm = {
      title: 'Smart Campus Waste Bin',
      teamRaw: 'Sami, Lynda',
      description: 'IoT automated sorting recycling bin.',
      tagsRaw: 'iot, ai',
      imageUrlsRaw: '',
      github: 'https://github.com/bin',
      demo: '',
    };

    await component.onSubmitProject();

    expect(mockClubLeadService.submitProject).toHaveBeenCalled();
    expect(component.showProjectModal()).toBeFalse();
  });
});
