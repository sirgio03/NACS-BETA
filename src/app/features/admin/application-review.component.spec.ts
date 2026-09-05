import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApplicationReviewComponent } from './application-review.component';
import { ApplicationService } from '../../core/services/application.service';
import { ClubApplication } from '../../core/models/application.model';

describe('ApplicationReviewComponent', () => {
  let component: ApplicationReviewComponent;
  let fixture: ComponentFixture<ApplicationReviewComponent>;
  let mockApplicationService: jasmine.SpyObj<ApplicationService>;

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

  beforeEach(async () => {
    mockApplicationService = jasmine.createSpyObj('ApplicationService', [
      'getApplications',
      'getApplicationStats',
      'approveApplication',
      'rejectApplication',
    ]);

    mockApplicationService.getApplications.and.returnValue(Promise.resolve([mockPendingApp]));
    mockApplicationService.getApplicationStats.and.returnValue(
      Promise.resolve({ pending: 1, approved: 0, rejected: 0, total: 1 })
    );

    await TestBed.configureTestingModule({
      imports: [ApplicationReviewComponent],
      providers: [
        provideRouter([]),
        { provide: ApplicationService, useValue: mockApplicationService },
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
    component.openRejectModal(mockPendingApp);
    expect(component.rejectionTarget()).toEqual(mockPendingApp);
    expect(component.rejectionReason).toBe('');
  });

  it('should not call rejectApplication if reason is whitespace only', async () => {
    component.openRejectModal(mockPendingApp);
    component.rejectionReason = '   ';
    await component.onConfirmReject();
    expect(mockApplicationService.rejectApplication).not.toHaveBeenCalled();
  });

  it('should call rejectApplication with trimmed reason when confirmed', async () => {
    mockApplicationService.rejectApplication.and.returnValue(
      Promise.resolve({
        success: true,
        message: 'Rejected',
        applicationId: 'app_test_1',
        reason: 'Proof invalid',
      })
    );
    component.openRejectModal(mockPendingApp);
    component.rejectionReason = 'Proof document does not match university records.';
    await component.onConfirmReject();
    expect(mockApplicationService.rejectApplication).toHaveBeenCalledWith(
      'app_test_1',
      'Proof document does not match university records.'
    );
  });

  it('should call approveApplication when onApprove is invoked', async () => {
    mockApplicationService.approveApplication.and.returnValue(
      Promise.resolve({
        success: true,
        message: 'Approved',
        clubId: 'club_tech_1',
      })
    );
    await component.onApprove(mockPendingApp);
    expect(mockApplicationService.approveApplication).toHaveBeenCalledWith('app_test_1');
  });
});
