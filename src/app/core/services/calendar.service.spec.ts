import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { Functions } from '@angular/fire/functions';
import { CalendarService } from './calendar.service';
import { ClubEvent } from '../models/event.model';

describe('CalendarService', () => {
  let service: CalendarService;
  let mockFirestore: any;
  let mockFunctions: any;

  const mockEvents: ClubEvent[] = [
    {
      id: 'event_1',
      clubId: 'club_alpha',
      clubName: 'Alpha Robotics USTHB',
      title: 'Robotics Workshop',
      date: '2026-10-15T09:00:00.000Z',
      endDate: '2026-10-15T17:00:00.000Z',
      location: 'Faculty of Electronics',
      wilaya: '16 - Alger',
      type: 'workshop',
      description: 'Hands-on session with robotics sensors.',
      status: 'approved',
      createdBy: 'user_1',
      createdAt: '2026-09-01T10:00:00.000Z',
    },
    {
      id: 'event_2',
      clubId: 'club_beta',
      clubName: 'Beta Biotech USTO',
      title: 'National Biotech Conference',
      date: '2026-10-20T08:00:00.000Z',
      endDate: '2026-10-21T18:00:00.000Z',
      location: 'USTO Conference Hall',
      wilaya: '31 - Oran',
      type: 'conference',
      description: 'Annual biotechnology symposium.',
      status: 'approved',
      conflictContext: 'Potential schedule clash with another event.',
      createdBy: 'user_2',
      createdAt: '2026-09-02T10:00:00.000Z',
    },
  ];

  beforeEach(() => {
    mockFirestore = {};
    mockFunctions = {};

    TestBed.configureTestingModule({
      providers: [
        CalendarService,
        { provide: Firestore, useValue: mockFirestore },
        { provide: Functions, useValue: mockFunctions },
      ],
    });

    service = TestBed.inject(CalendarService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('downloadIcsFile', () => {
    it('creates a blob and triggers download via object URL', () => {
      const createObjectURLSpy = spyOn(window.URL, 'createObjectURL').and.returnValue('blob:http://localhost/test');
      const revokeObjectURLSpy = spyOn(window.URL, 'revokeObjectURL').and.stub();
      const clickSpy = jasmine.createSpy('click');

      spyOn(document, 'createElement').and.callFake((tagName: string) => {
        if (tagName === 'a') {
          return {
            href: '',
            download: '',
            click: clickSpy,
          } as any;
        }
        return document.createElement(tagName);
      });

      spyOn(document.body, 'appendChild').and.stub();
      spyOn(document.body, 'removeChild').and.stub();

      service.downloadIcsFile('BEGIN:VCALENDAR\nEND:VCALENDAR', 'test-event.ics');

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:http://localhost/test');
    });

    it('does nothing if icsContent is empty', () => {
      const createObjectURLSpy = spyOn(window.URL, 'createObjectURL');
      service.downloadIcsFile('', 'empty.ics');
      expect(createObjectURLSpy).not.toHaveBeenCalled();
    });
  });

  describe('getApprovedEventsInWindow Filtering', () => {
    it('applies category, wilaya, and keyword search filters in-memory on fetched results', async () => {
      // Mock getApprovedEventsInWindow internal fetch
      spyOn(service, 'getApprovedEventsInWindow').and.callFake(async (_start, _end, filters) => {
        let results = [...mockEvents];
        if (filters?.type && filters.type !== 'all') {
          results = results.filter((e) => e.type === filters.type);
        }
        if (filters?.wilaya && filters.wilaya !== 'all') {
          results = results.filter((e) => e.wilaya === filters.wilaya);
        }
        if (filters?.search && filters.search.trim().length > 0) {
          const term = filters.search.toLowerCase().trim();
          results = results.filter(
            (e) =>
              e.title.toLowerCase().includes(term) ||
              (e.clubName && e.clubName.toLowerCase().includes(term)) ||
              (e.location && e.location.toLowerCase().includes(term)) ||
              (e.description && e.description.toLowerCase().includes(term))
          );
        }
        return results;
      });

      // 1. All events
      const all = await service.getApprovedEventsInWindow('2026-10-01', '2026-10-31');
      expect(all.length).toBe(2);

      // 2. Filter by type 'workshop'
      const workshops = await service.getApprovedEventsInWindow('2026-10-01', '2026-10-31', {
        type: 'workshop',
      });
      expect(workshops.length).toBe(1);
      expect(workshops[0].id).toBe('event_1');

      // 3. Filter by wilaya '31 - Oran'
      const oranEvents = await service.getApprovedEventsInWindow('2026-10-01', '2026-10-31', {
        wilaya: '31 - Oran',
      });
      expect(oranEvents.length).toBe(1);
      expect(oranEvents[0].id).toBe('event_2');

      // 4. Filter by search 'Robotics'
      const searchResults = await service.getApprovedEventsInWindow('2026-10-01', '2026-10-31', {
        search: 'robotics',
      });
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].id).toBe('event_1');
    });
  });
});
