import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CalendarService, CalendarFilterOptions } from '../../core/services/calendar.service';
import { ClubEvent, ALGERIAN_WILAYAS, EventType } from '../../core/models/event.model';

export type CalendarViewMode = 'month' | 'week' | 'agenda';

export interface CalendarDay {
  date: Date;
  dateString: string; // 'YYYY-MM-DD'
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: ClubEvent[];
}

export interface CalendarWeekDay {
  date: Date;
  dateString: string;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  events: ClubEvent[];
}

export interface AgendaGroup {
  dateString: string;
  displayDate: string;
  events: ClubEvent[];
}

@Component({
  selector: 'nacs-calendar-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss'],
})
export class CalendarViewComponent implements OnInit {
  private readonly calendarService = inject(CalendarService);

  readonly wilayas = ALGERIAN_WILAYAS;
  readonly eventTypes: EventType[] = [
    'hackathon',
    'workshop',
    'conference',
    'seminar',
    'competition',
    'cultural',
    'meetup',
  ];
  readonly dayNamesShort = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  // View state
  readonly viewMode = signal<CalendarViewMode>('month');
  readonly currentDate = signal<Date>(new Date());
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // Raw events loaded for the active window
  readonly windowEvents = signal<ClubEvent[]>([]);

  // Filter signals
  readonly selectedType = signal<string>('all');
  readonly selectedWilaya = signal<string>('all');
  readonly searchQuery = signal<string>('');

  // Modal inspection state
  readonly selectedEvent = signal<ClubEvent | null>(null);
  readonly isExportingIcs = signal<boolean>(false);
  readonly exportSuccessMessage = signal<string | null>(null);

  // Active date range title (e.g. "Octobre 2026" or "12 Oct - 18 Oct 2026")
  readonly viewTitle = computed<string>(() => {
    const d = this.currentDate();
    const mode = this.viewMode();
    if (mode === 'month' || mode === 'agenda') {
      return d.toLocaleDateString('fr-DZ', { month: 'long', year: 'numeric' });
    }
    // Week view title: start and end of week
    const start = this.getStartOfWeek(d);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const startStr = start.toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short' });
    const endStr = end.toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  });

  // Filtered events based on user selection
  readonly filteredEvents = computed<ClubEvent[]>(() => {
    let events = this.windowEvents();
    const type = this.selectedType();
    const wilaya = this.selectedWilaya();
    const search = this.searchQuery().toLowerCase().trim();

    if (type !== 'all') {
      events = events.filter((e) => e.type === type);
    }
    if (wilaya !== 'all') {
      events = events.filter((e) => e.wilaya === wilaya);
    }
    if (search.length > 0) {
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(search) ||
          (e.clubName && e.clubName.toLowerCase().includes(search)) ||
          (e.location && e.location.toLowerCase().includes(search)) ||
          (e.description && e.description.toLowerCase().includes(search))
      );
    }
    return events;
  });

  // Month grid computation: 35 or 42 cells covering leading days, month days, trailing days
  readonly monthDays = computed<CalendarDay[]>(() => {
    const current = this.currentDate();
    const year = current.getFullYear();
    const month = current.getMonth();
    const todayStr = this.formatDateIso(new Date());

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
    const daysInMonth = lastDayOfMonth.getDate();

    const days: CalendarDay[] = [];

    // Leading days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i);
      const dateString = this.formatDateIso(d);
      days.push({
        date: d,
        dateString,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: dateString === todayStr,
        events: this.getEventsForDate(dateString),
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateString = this.formatDateIso(d);
      days.push({
        date: d,
        dateString,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateString === todayStr,
        events: this.getEventsForDate(dateString),
      });
    }

    // Trailing days to fill the final week row (total cells should be multiple of 7)
    const totalFilled = days.length;
    const remaining = totalFilled % 7 === 0 ? 0 : 7 - (totalFilled % 7);
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      const dateString = this.formatDateIso(d);
      days.push({
        date: d,
        dateString,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
        events: this.getEventsForDate(dateString),
      });
    }

    return days;
  });

  // Week days computation: 7 days starting from Sunday
  readonly weekDays = computed<CalendarWeekDay[]>(() => {
    const current = this.currentDate();
    const startOfWeek = this.getStartOfWeek(current);
    const todayStr = this.formatDateIso(new Date());
    const days: CalendarWeekDay[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const dateString = this.formatDateIso(d);
      days.push({
        date: d,
        dateString,
        dayName: this.dayNamesShort[d.getDay()],
        dayNumber: d.getDate(),
        isToday: dateString === todayStr,
        events: this.getEventsForDate(dateString),
      });
    }

    return days;
  });

  // Agenda list computation: grouped chronologically by date
  readonly agendaGroups = computed<AgendaGroup[]>(() => {
    const events = [...this.filteredEvents()];
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const groupMap = new Map<string, ClubEvent[]>();
    for (const e of events) {
      const dateKey = e.date.split('T')[0];
      if (!groupMap.has(dateKey)) {
        groupMap.set(dateKey, []);
      }
      groupMap.get(dateKey)!.push(e);
    }

    const groups: AgendaGroup[] = [];
    for (const [dateString, dayEvents] of groupMap.entries()) {
      const dateObj = new Date(dateString);
      const displayDate = dateObj.toLocaleDateString('fr-DZ', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      groups.push({
        dateString,
        displayDate,
        events: dayEvents,
      });
    }

    return groups;
  });

  constructor() {
    // When currentDate or viewMode changes, re-fetch the date-bounded window from Firestore
    effect(() => {
      const current = this.currentDate();
      const mode = this.viewMode();
      this.fetchWindowEvents(current, mode);
    });
  }

  ngOnInit(): void {
    // Initial fetch triggered by effect
  }

  // Navigation handlers
  previous(): void {
    const current = new Date(this.currentDate());
    const mode = this.viewMode();
    if (mode === 'month' || mode === 'agenda') {
      current.setMonth(current.getMonth() - 1);
    } else {
      current.setDate(current.getDate() - 7);
    }
    this.currentDate.set(current);
  }

  next(): void {
    const current = new Date(this.currentDate());
    const mode = this.viewMode();
    if (mode === 'month' || mode === 'agenda') {
      current.setMonth(current.getMonth() + 1);
    } else {
      current.setDate(current.getDate() + 7);
    }
    this.currentDate.set(current);
  }

  today(): void {
    this.currentDate.set(new Date());
  }

  setViewMode(mode: CalendarViewMode): void {
    this.viewMode.set(mode);
  }

  // Filter setters
  setType(type: string): void {
    this.selectedType.set(type);
  }

  setWilaya(wilaya: string): void {
    this.selectedWilaya.set(wilaya);
  }

  resetFilters(): void {
    this.selectedType.set('all');
    this.selectedWilaya.set('all');
    this.searchQuery.set('');
  }

  // Modal handlers
  openEventModal(event: ClubEvent): void {
    this.selectedEvent.set(event);
    this.exportSuccessMessage.set(null);
  }

  closeEventModal(): void {
    this.selectedEvent.set(null);
    this.exportSuccessMessage.set(null);
  }

  // Conflict detection check (Feature 5 schema: conflictContext != null or conflictWithEventId != null)
  hasConflict(event: ClubEvent): boolean {
    return !!event.conflictContext || !!event.conflictWithEventId;
  }

  // Export handlers
  async downloadEventIcs(event: ClubEvent): Promise<void> {
    if (!event.id) return;
    this.isExportingIcs.set(true);
    this.errorMessage.set(null);
    try {
      await this.calendarService.downloadEventIcs(event.id, event.title);
      this.exportSuccessMessage.set('Fichier .ics téléchargé avec succès !');
      setTimeout(() => this.exportSuccessMessage.set(null), 3500);
    } catch (err: any) {
      console.error('Failed to export event ICS:', err);
      this.errorMessage.set('Échec de l\'exportation de l\'événement. Veuillez réessayer.');
    } finally {
      this.isExportingIcs.set(false);
    }
  }

  async downloadAllVisibleIcs(): Promise<void> {
    const visibleEvents = this.filteredEvents();
    const eventIds = visibleEvents.map((e) => e.id).filter((id): id is string => !!id);
    if (eventIds.length === 0) return;

    this.isExportingIcs.set(true);
    this.errorMessage.set(null);
    try {
      await this.calendarService.downloadMultipleEventsIcs(eventIds, 'nacs-calendrier-national.ics');
      this.exportSuccessMessage.set(`${eventIds.length} événements exportés en format .ics !`);
      setTimeout(() => this.exportSuccessMessage.set(null), 3500);
    } catch (err: any) {
      console.error('Failed to batch export calendar ICS:', err);
      this.errorMessage.set('Échec de l\'exportation collective. Veuillez réessayer.');
    } finally {
      this.isExportingIcs.set(false);
    }
  }

  // Helper date methods
  formatTime(isoString: string): string {
    try {
      const d = new Date(isoString);
      const pad = (n: number) => (n < 10 ? '0' + n : String(n));
      // Display local time
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return '';
    }
  }

  formatFullDateTime(startIso: string, endIso?: string): string {
    try {
      const start = new Date(startIso);
      const dateStr = start.toLocaleDateString('fr-DZ', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const startTime = this.formatTime(startIso);
      if (endIso) {
        const endTime = this.formatTime(endIso);
        return `${dateStr} • ${startTime} – ${endTime}`;
      }
      return `${dateStr} • ${startTime}`;
    } catch {
      return startIso;
    }
  }

  private formatDateIso(d: Date): string {
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private getStartOfWeek(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay(); // 0 is Sunday
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getEventsForDate(dateString: string): ClubEvent[] {
    return this.filteredEvents().filter((e) => {
      const eventDateStr = e.date ? e.date.split('T')[0] : '';
      return eventDateStr === dateString;
    });
  }

  private async fetchWindowEvents(date: Date, mode: CalendarViewMode): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    let startWindow: Date;
    let endWindow: Date;

    if (mode === 'week') {
      const startOfWeek = this.getStartOfWeek(date);
      startWindow = new Date(startOfWeek);
      // Small buffer (-1 day to +8 days)
      startWindow.setDate(startWindow.getDate() - 1);
      endWindow = new Date(startOfWeek);
      endWindow.setDate(endWindow.getDate() + 8);
    } else {
      // Month & Agenda view: pad by 7 days before and 7 days after month bounds
      const year = date.getFullYear();
      const month = date.getMonth();
      startWindow = new Date(year, month, -7);
      endWindow = new Date(year, month + 1, 8);
    }

    const startIso = startWindow.toISOString();
    const endIso = endWindow.toISOString();

    try {
      const events = await this.calendarService.getApprovedEventsInWindow(startIso, endIso);
      this.windowEvents.set(events);
    } catch (err: any) {
      console.error('Error fetching calendar events in window:', err);
      this.errorMessage.set('Impossible de charger les événements du calendrier. Veuillez actualiser la page.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
