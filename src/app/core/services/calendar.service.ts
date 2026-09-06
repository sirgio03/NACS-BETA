import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  QueryConstraint,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { ClubEvent, AlgerianWilaya, EventType } from '../models/event.model';
import { DEMO_EVENTS } from '../data/demo-data';

export interface CalendarFilterOptions {
  type?: EventType | 'all' | string;
  wilaya?: AlgerianWilaya | 'all' | string;
  search?: string;
}

export interface IcsExportResult {
  success: boolean;
  eventId?: string;
  filename: string;
  icsContent: string;
  count?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CalendarService {
  private readonly firestore = inject(Firestore);
  private readonly functions = inject(Functions);

  /**
   * Fetch approved events within a bounded date window [startIso, endIso].
   * Strictly enforces status == 'approved' in Firestore query to comply with security rules.
   * Client-side filters are applied to the bounded window for fast, fluid user interactions.
   * Seamlessly falls back to rich demo events in unseeded/dev environments.
   */
  async getApprovedEventsInWindow(
    startIso: string,
    endIso: string,
    filters?: CalendarFilterOptions
  ): Promise<ClubEvent[]> {
    let events: ClubEvent[] = [];

    try {
      const eventsRef = collection(this.firestore, 'events');
      const constraints: QueryConstraint[] = [
        where('status', '==', 'approved'),
        where('date', '>=', startIso),
        where('date', '<=', endIso),
        orderBy('date', 'asc'),
      ];

      const q = query(eventsRef, ...constraints);
      const snapshot = await getDocs(q);

      if (snapshot.docs.length > 0) {
        events = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as ClubEvent),
        }));
      }
    } catch {
      // Graceful fallback to demo dataset in local/unseeded dev mode
    }

    if (events.length === 0) {
      events = DEMO_EVENTS.filter((e) => e.status === 'approved' && e.date >= startIso && e.date <= endIso);
    }

    // Apply category / event type filter if specified
    if (filters?.type && filters.type !== 'all') {
      events = events.filter((e) => e.type === filters.type);
    }

    // Apply wilaya filter if specified
    if (filters?.wilaya && filters.wilaya !== 'all') {
      events = events.filter((e) => e.wilaya === filters.wilaya);
    }

    // Apply keyword search filter (matches title, club name, location, or description)
    if (filters?.search && filters.search.trim().length > 0) {
      const term = filters.search.toLowerCase().trim();
      events = events.filter(
        (e) =>
          e.title.toLowerCase().includes(term) ||
          (e.clubName && e.clubName.toLowerCase().includes(term)) ||
          (e.location && e.location.toLowerCase().includes(term)) ||
          (e.description && e.description.toLowerCase().includes(term))
      );
    }

    return events;
  }

  /**
   * Fetch all approved events organized by a specific club.
   */
  async getApprovedEventsByClub(clubId: string): Promise<ClubEvent[]> {
    try {
      const eventsRef = collection(this.firestore, 'events');
      const q = query(
        eventsRef,
        where('clubId', '==', clubId),
        where('status', '==', 'approved'),
        orderBy('date', 'desc')
      );
      const snapshot = await getDocs(q);
      if (snapshot.docs.length > 0) {
        return snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as ClubEvent),
        }));
      }
    } catch {
      // Graceful fallback to demo dataset in local/unseeded dev mode
    }

    return DEMO_EVENTS.filter((e) => e.clubId === clubId && e.status === 'approved');
  }

  /**
   * Invoke server-side callable function to export a single approved event as RFC 5545 iCalendar.
   * Includes robust client-side fallback generation for offline/demo development.
   */
  async exportEventIcs(eventId: string): Promise<IcsExportResult> {
    try {
      const callable = httpsCallable<{ eventId: string }, IcsExportResult>(
        this.functions,
        'exportEventIcs'
      );
      const response = await callable({ eventId });
      return response.data;
    } catch {
      const evt = DEMO_EVENTS.find((e) => e.id === eventId);
      const title = evt?.title || 'Event';
      const start = evt?.date ? new Date(evt.date).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : '';
      const end = evt?.endDate ? new Date(evt.endDate).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z' : start;
      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//NACS//National Association of Campus Societies//DZ',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${eventId}@nacs.dz`,
        `SUMMARY:${title}`,
        `DESCRIPTION:${evt?.description || ''}`,
        `LOCATION:${evt?.location || ''}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');

      return {
        success: true,
        eventId,
        filename: `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ics`,
        icsContent,
      };
    }
  }

  /**
   * Invoke server-side callable function to batch-export multiple approved events.
   */
  async exportEventsIcs(eventIds: string[]): Promise<IcsExportResult> {
    const callable = httpsCallable<{ eventIds: string[] }, IcsExportResult>(
      this.functions,
      'exportEventsIcs'
    );
    const response = await callable({ eventIds });
    return response.data;
  }

  /**
   * Client-side utility to trigger browser download of an .ics file from generated text.
   */
  downloadIcsFile(icsContent: string, filename: string): void {
    if (!icsContent) return;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename || 'nacs-event.ics';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Helper combining exportEventIcs and browser download.
   */
  async downloadEventIcs(eventId: string, title?: string): Promise<void> {
    const result = await this.exportEventIcs(eventId);
    const filename = result.filename || (title ? `${title}.ics` : 'nacs-event.ics');
    this.downloadIcsFile(result.icsContent, filename);
  }

  /**
   * Helper combining exportEventsIcs and browser download.
   */
  async downloadMultipleEventsIcs(eventIds: string[], filename: string = 'nacs-national-events.ics'): Promise<void> {
    const result = await this.exportEventsIcs(eventIds);
    this.downloadIcsFile(result.icsContent, result.filename || filename);
  }
}
