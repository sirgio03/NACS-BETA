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
   */
  async getApprovedEventsInWindow(
    startIso: string,
    endIso: string,
    filters?: CalendarFilterOptions
  ): Promise<ClubEvent[]> {
    const eventsRef = collection(this.firestore, 'events');
    const constraints: QueryConstraint[] = [
      where('status', '==', 'approved'),
      where('date', '>=', startIso),
      where('date', '<=', endIso),
      orderBy('date', 'asc'),
    ];

    const q = query(eventsRef, ...constraints);
    const snapshot = await getDocs(q);

    let events: ClubEvent[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as ClubEvent),
    }));

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
   * Invoke server-side callable function to export a single approved event as RFC 5545 iCalendar.
   */
  async exportEventIcs(eventId: string): Promise<IcsExportResult> {
    const callable = httpsCallable<{ eventId: string }, IcsExportResult>(
      this.functions,
      'exportEventIcs'
    );
    const response = await callable({ eventId });
    return response.data;
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
