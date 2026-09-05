import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { ModerationService } from './moderation.service';

describe('ModerationService', () => {
  let service: ModerationService;
  let mockFirestore: any;
  let mockFunctions: any;

  beforeEach(() => {
    mockFirestore = {};
    mockFunctions = {};

    TestBed.configureTestingModule({
      providers: [
        ModerationService,
        { provide: Firestore, useValue: mockFirestore },
        { provide: Functions, useValue: mockFunctions },
      ],
    });

    service = TestBed.inject(ModerationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
