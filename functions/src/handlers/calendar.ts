import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export interface ExportEventIcsPayload {
  eventId: string;
}

export interface ExportEventsIcsPayload {
  eventIds: string[];
}

/**
 * Format an ISO 8601 date string into RFC 5545 local datetime for Africa/Algiers (UTC+1, no DST).
 * Output format: YYYYMMDDTHHmmss
 */
export function formatIcsDate(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date string: ${isoString}`);
  }
  // Algeria is permanently UTC+1 (West Africa Time / CET, no daylight saving time).
  const algiersMillis = d.getTime() + 60 * 60 * 1000;
  const algDate = new Date(algiersMillis);

  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  const yyyy = algDate.getUTCFullYear();
  const mm = pad(algDate.getUTCMonth() + 1);
  const dd = pad(algDate.getUTCDate());
  const hh = pad(algDate.getUTCHours());
  const min = pad(algDate.getUTCMinutes());
  const ss = pad(algDate.getUTCSeconds());

  return `${yyyy}${mm}${dd}T${hh}${min}${ss}`;
}

/**
 * Format a Date object into UTC datetime for RFC 5545 DTSTAMP.
 * Output format: YYYYMMDDTHHmmssZ
 */
export function formatUtcDate(date: Date): string {
  const pad = (n: number) => (n < 10 ? '0' + n : String(n));
  const yyyy = date.getUTCFullYear();
  const mm = pad(date.getUTCMonth() + 1);
  const dd = pad(date.getUTCDate());
  const hh = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${yyyy}${mm}${dd}T${hh}${min}${ss}Z`;
}

/**
 * Sanitize text fields for iCalendar RFC 5545.
 * Escapes backslashes, semicolons, commas, and normalizes line breaks.
 */
export function sanitizeIcsText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Generates a clean URL slug for the .ics download filename.
 */
export function slugify(text: string): string {
  if (!text || typeof text !== 'string') return 'nacs-event';
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'nacs-event'
  );
}

/**
 * Build a VEVENT component string from event data.
 * Adheres strictly to RFC 5545. Excludes all private internal notes (rejectionReason, reviewedBy, etc.).
 */
export function buildVEvent(eventId: string, eventData: any): string {
  const dtStamp = formatUtcDate(new Date());
  const dtStart = formatIcsDate(eventData.date);
  const dtEnd = eventData.endDate ? formatIcsDate(eventData.endDate) : dtStart;
  const summary = sanitizeIcsText(eventData.title || 'NACS Campus Society Event');
  const description = sanitizeIcsText(eventData.description || '');

  const locationParts: string[] = [];
  if (eventData.location) locationParts.push(eventData.location);
  if (eventData.wilaya) locationParts.push(eventData.wilaya);
  const location = sanitizeIcsText(locationParts.join(', '));

  const organizerName = sanitizeIcsText(eventData.clubName || 'National Association of Campus Societies');
  const url = `https://nacs.dz/calendar?event=${encodeURIComponent(eventId)}`;

  return [
    'BEGIN:VEVENT',
    `UID:${eventId}@nacs.dz`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Africa/Algiers:${dtStart}`,
    `DTEND;TZID=Africa/Algiers:${dtEnd}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `ORGANIZER;CN=${organizerName}:mailto:events@nacs.dz`,
    `URL:${url}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
  ].join('\r\n');
}

/**
 * Wrap VEVENT blocks inside a complete VCALENDAR envelope with Africa/Algiers VTIMEZONE.
 */
export function wrapVCalendar(vevents: string[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//National Association of Campus Societies//NACS Platform Calendar 1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VTIMEZONE',
    'TZID:Africa/Algiers',
    'LAST-MODIFIED:20260101T000000Z',
    'BEGIN:STANDARD',
    'TZNAME:CET',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0100',
    'DTSTART:19700101T000000',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...vevents,
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}

/**
 * Callable Cloud Function: exportEventIcs
 * Exports a single event in RFC 5545 iCalendar (.ics) format.
 * Invariant: Strictly rejects requests for events where status !== 'approved'.
 */
export const exportEventIcs = onCall<ExportEventIcsPayload>(async (request) => {
  const { eventId } = request.data || {};
  if (!eventId || typeof eventId !== 'string' || !eventId.trim()) {
    throw new HttpsError('invalid-argument', 'Missing or invalid eventId parameter.');
  }

  const cleanEventId = eventId.trim();
  const db = admin.firestore();
  const eventDoc = await db.collection('events').doc(cleanEventId).get();

  if (!eventDoc.exists) {
    throw new HttpsError('not-found', `Event with ID "${cleanEventId}" was not found.`);
  }

  const eventData = eventDoc.data();
  if (!eventData) {
    throw new HttpsError('internal', 'Unable to retrieve event record.');
  }

  // Security Invariant: Only approved events may be exported
  if (eventData.status !== 'approved') {
    throw new HttpsError(
      'failed-precondition',
      `Cannot export unapproved event. Current status is '${eventData.status}'.`
    );
  }

  const vevent = buildVEvent(cleanEventId, eventData);
  const icsContent = wrapVCalendar([vevent]);
  const filename = `${slugify(eventData.title || cleanEventId)}.ics`;

  return {
    success: true,
    eventId: cleanEventId,
    filename,
    icsContent,
  };
});

/**
 * Callable Cloud Function: exportEventsIcs
 * Exports multiple approved events (e.g. filtered calendar view) as a single .ics calendar.
 * Invariant: Silently discards or rejects unapproved events, exporting only confirmed approved items.
 */
export const exportEventsIcs = onCall<ExportEventsIcsPayload>(async (request) => {
  const { eventIds } = request.data || {};
  if (!Array.isArray(eventIds) || eventIds.length === 0) {
    throw new HttpsError('invalid-argument', 'Missing or invalid eventIds parameter; array of IDs is required.');
  }

  // Bound batch size to max 50 items to prevent resource exhaustion
  const boundedIds = eventIds.slice(0, 50).filter((id) => typeof id === 'string' && id.trim().length > 0);
  if (boundedIds.length === 0) {
    throw new HttpsError('invalid-argument', 'No valid event IDs provided.');
  }

  const db = admin.firestore();
  const snapshots = await Promise.all(boundedIds.map((id) => db.collection('events').doc(id).get()));

  const approvedVevents: string[] = [];
  for (const snap of snapshots) {
    if (snap.exists) {
      const data = snap.data();
      if (data && data.status === 'approved') {
        approvedVevents.push(buildVEvent(snap.id, data));
      }
    }
  }

  if (approvedVevents.length === 0) {
    throw new HttpsError('failed-precondition', 'No approved events found for the requested IDs.');
  }

  const icsContent = wrapVCalendar(approvedVevents);
  const filename = 'nacs-national-events.ics';

  return {
    success: true,
    count: approvedVevents.length,
    filename,
    icsContent,
  };
});
