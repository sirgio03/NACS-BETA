import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { ClubService } from './club.service';

describe('ClubService', () => {
  let service: ClubService;
  let mockFirestore: any;

  beforeEach(() => {
    mockFirestore = {};

    TestBed.configureTestingModule({
      providers: [
        ClubService,
        { provide: Firestore, useValue: mockFirestore },
      ],
    });

    service = TestBed.inject(ClubService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
