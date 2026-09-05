import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CalendarViewComponent } from './calendar-view.component';
import { CalendarService } from '../../core/services/calendar.service';
import { ClubEvent } from '../../core/models/event.model';

describe('CalendarViewComponent', () => {
  let component: CalendarViewComponent;
  let fixture: ComponentFixture<CalendarViewComponent>;
  let mockCalendarService: any;

  const mockEvents: ClubEvent[] = [
    {
      id: 'evt_1',
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
      id: 'evt_2',
      clubId: 'club_beta',
      clubName: 'Beta Biotech USTO',
      title: 'Biotech Innovation Summit',
      date: '2026-10-16T08:00:00.000Z',
      endDate: '2026-10-17T18:00:00.000Z',
      location: 'USTO Conference Hall',
      wilaya: '31 - Oran',
      type: 'conference',
      description: 'National student biotech summit.',
      status: 'approved',
      conflictContext: 'Potential clash with approved event on 2026-10-15.',
      createdBy: 'user_2',
      createdAt: '2026-09-02T10:00:00.000Z',
    },
  ];

  beforeEach(async () => {
    mockCalendarService = {
      getApprovedEventsInWindow: jasmine.createSpy('getApprovedEventsInWindow').and.returnValue(Promise.resolve(mockEvents)),
      downloadEventIcs: jasmine.createSpy('downloadEventIcs').and.returnValue(Promise.resolve()),
      downloadMultipleEventsIcs: jasmine.createSpy('downloadMultipleEventsIcs').and.returnValue(Promise.resolve()),
    };

    await TestBed.configureTestingModule({
      imports: [CalendarViewComponent],
      providers: [
        provideRouter([]),
        { provide: CalendarService, useValue: mockCalendarService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarViewComponent);
    component = fixture.componentInstance;
    // Fix current date to October 2026 for predictable testing
    component.currentDate.set(new Date('2026-10-15T10:00:00.000Z'));
    fixture.detectChanges();
  });

  it('should create the calendar component and initialize with month view', () => {
    expect(component).toBeTruthy();
    expect(component.viewMode()).toBe('month');
  });

  it('fetches approved events in the bounded date window upon initialization', fakeAsync(() => {
    tick();
    expect(mockCalendarService.getApprovedEventsInWindow).toHaveBeenCalled();
    expect(component.windowEvents().length).toBe(2);
    expect(component.filteredEvents().length).toBe(2);
  }));

  describe('View Mode Switching', () => {
    it('allows toggling between month, week, and agenda view modes', () => {
      component.setViewMode('week');
      expect(component.viewMode()).toBe('week');

      component.setViewMode('agenda');
      expect(component.viewMode()).toBe('agenda');

      component.setViewMode('month');
      expect(component.viewMode()).toBe('month');
    });
  });

  describe('Navigation', () => {
    it('navigates to next and previous month in month view', () => {
      const initialMonth = component.currentDate().getMonth();

      component.next();
      expect(component.currentDate().getMonth()).toBe((initialMonth + 1) % 12);

      component.previous();
      expect(component.currentDate().getMonth()).toBe(initialMonth);
    });

    it('navigates by 7 days in week view', () => {
      component.setViewMode('week');
      const initialDate = component.currentDate().getDate();

      component.next();
      expect(component.currentDate().getDate()).toBe(initialDate + 7);

      component.previous();
      expect(component.currentDate().getDate()).toBe(initialDate);
    });

    it('today() resets date to current day', () => {
      component.currentDate.set(new Date('2025-01-01'));
      component.today();
      const now = new Date();
      expect(component.currentDate().toDateString()).toBe(now.toDateString());
    });
  });

  describe('Filtering and Search', () => {
    beforeEach(fakeAsync(() => {
      tick();
    }));

    it('filters events by category / event type', () => {
      component.setType('workshop');
      expect(component.filteredEvents().length).toBe(1);
      expect(component.filteredEvents()[0].id).toBe('evt_1');

      component.setType('all');
      expect(component.filteredEvents().length).toBe(2);
    });

    it('filters events by wilaya', () => {
      component.setWilaya('31 - Oran');
      expect(component.filteredEvents().length).toBe(1);
      expect(component.filteredEvents()[0].id).toBe('evt_2');

      component.setWilaya('all');
      expect(component.filteredEvents().length).toBe(2);
    });

    it('filters events by search keyword', () => {
      component.searchQuery.set('Biotech');
      expect(component.filteredEvents().length).toBe(1);
      expect(component.filteredEvents()[0].id).toBe('evt_2');

      component.searchQuery.set('');
      expect(component.filteredEvents().length).toBe(2);
    });

    it('resetFilters clears all active filters', () => {
      component.setType('conference');
      component.setWilaya('31 - Oran');
      component.searchQuery.set('robotics');

      component.resetFilters();
      expect(component.selectedType()).toBe('all');
      expect(component.selectedWilaya()).toBe('all');
      expect(component.searchQuery()).toBe('');
      expect(component.filteredEvents().length).toBe(2);
    });
  });

  describe('Conflict Indicator Logic', () => {
    it('hasConflict identifies events with proximity flags', () => {
      expect(component.hasConflict(mockEvents[0])).toBeFalse();
      expect(component.hasConflict(mockEvents[1])).toBeTrue();
    });
  });

  describe('Inspection Modal & ICS Download', () => {
    it('opens and closes event detail modal', () => {
      component.openEventModal(mockEvents[0]);
      expect(component.selectedEvent()).toEqual(mockEvents[0]);

      component.closeEventModal();
      expect(component.selectedEvent()).toBeNull();
    });

    it('downloadEventIcs delegates to CalendarService and displays success feedback', fakeAsync(() => {
      component.downloadEventIcs(mockEvents[0]);
      expect(component.isExportingIcs()).toBeTrue();
      tick();
      expect(mockCalendarService.downloadEventIcs).toHaveBeenCalledWith('evt_1', 'Robotics Workshop');
      expect(component.isExportingIcs()).toBeFalse();
      expect(component.exportSuccessMessage()).toContain('téléchargé');
    }));

    it('downloadAllVisibleIcs delegates to CalendarService for batch export', fakeAsync(() => {
      tick();
      component.downloadAllVisibleIcs();
      expect(component.isExportingIcs()).toBeTrue();
      tick();
      expect(mockCalendarService.downloadMultipleEventsIcs).toHaveBeenCalledWith(
        ['evt_1', 'evt_2'],
        'nacs-calendrier-national.ics'
      );
      expect(component.isExportingIcs()).toBeFalse();
      expect(component.exportSuccessMessage()).toContain('2 événements exportés');
    }));
  });
});
