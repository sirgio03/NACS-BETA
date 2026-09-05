import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { ShowcaseService } from './showcase.service';

describe('ShowcaseService', () => {
  let service: ShowcaseService;
  let mockFirestore: any;

  beforeEach(() => {
    mockFirestore = {};

    TestBed.configureTestingModule({
      providers: [
        ShowcaseService,
        { provide: Firestore, useValue: mockFirestore },
      ],
    });

    service = TestBed.inject(ShowcaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
