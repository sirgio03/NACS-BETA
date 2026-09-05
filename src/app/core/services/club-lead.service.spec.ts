import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { ClubLeadService } from './club-lead.service';

describe('ClubLeadService', () => {
  let service: ClubLeadService;
  let mockFirestore: any;
  let mockFunctions: any;

  beforeEach(() => {
    mockFirestore = {};
    mockFunctions = {};

    TestBed.configureTestingModule({
      providers: [
        ClubLeadService,
        { provide: Firestore, useValue: mockFirestore },
        { provide: Functions, useValue: mockFunctions },
      ],
    });

    service = TestBed.inject(ClubLeadService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
