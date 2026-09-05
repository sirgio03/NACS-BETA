import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { ApplicationService } from './application.service';

describe('ApplicationService', () => {
  let service: ApplicationService;
  let mockFirestore: any;
  let mockFunctions: any;

  beforeEach(() => {
    mockFirestore = {};
    mockFunctions = {};

    TestBed.configureTestingModule({
      providers: [
        ApplicationService,
        { provide: Firestore, useValue: mockFirestore },
        { provide: Functions, useValue: mockFunctions },
      ],
    });

    service = TestBed.inject(ApplicationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should reject application rejection if reason is empty or whitespace', async () => {
    await expectAsync(service.rejectApplication('app_123', '')).toBeRejectedWithError(
      'A rejection reason is strictly required.'
    );
    await expectAsync(service.rejectApplication('app_123', '   ')).toBeRejectedWithError(
      'A rejection reason is strictly required.'
    );
  });
});
