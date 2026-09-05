import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as admin from 'firebase-admin';
import {
  exportEventIcs,
  exportEventsIcs,
  formatIcsDate,
  formatUtcDate,
  sanitizeIcsText,
  slugify,
} from '../src/handlers/calendar';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'nacs-calendar-test' });
}

// In-memory mock events database
const mockEventsDb: Record<string, any> = {
  event_approved_1: {
    clubId: 'club_alpha',
    clubName: 'Alpha Robotics USTHB',
    title: 'Autonomous Robotics Workshop',
    date: '2026-10-15T09:00:00.000Z', // In UTC, 09:00 UTC = 10:00 Africa/Algiers
    endDate: '2026-10-15T17:00:00.000Z', // In UTC, 17:00 UTC = 18:00 Africa/Algiers
    location: 'Amphi D, Faculty of Electronics',
    wilaya: '16 - Alger',
    type: 'workshop',
    description: 'Hands-on session building Arduino-powered line-follower rovers.',
    status: 'approved',
    createdBy: 'uid_student_lead',
    reviewedBy: 'uid_board_officer',
  },
  event_with_special_chars: {
    clubId: 'club_alpha',
    clubName: 'Alpha Robotics USTHB',
    title: 'Robotics, AI; Machine Learning & Vision\\Audio',
    date: '2026-11-20T13:00:00.000Z',
    endDate: '2026-11-20T16:00:00.000Z',
    location: 'Room 101, USTHB, Bab Ezzouar',
    wilaya: '16 - Alger',
    type: 'seminar',
    description: 'First line.\nSecond line with; semicolon and, comma.\r\nThird line with \\ backslash.',
    status: 'approved',
  },
  event_pending_1: {
    clubId: 'club_beta',
    clubName: 'Beta Biotech USTO',
    title: 'Biotech Innovation Summit',
    date: '2026-11-01T08:00:00.000Z',
    endDate: '2026-11-01T15:00:00.000Z',
    location: 'Auditorium USTO',
    wilaya: '31 - Oran',
    type: 'conference',
    description: 'Annual national summit on student biotech research.',
    status: 'pending',
  },
  event_flagged_1: {
    clubId: 'club_gamma',
    clubName: 'Gamma CS Club ESI',
    title: 'Algorithmic Hackathon 2026',
    date: '2026-10-16T08:00:00.000Z',
    endDate: '2026-10-18T18:00:00.000Z',
    location: 'ESI Oued Smar',
    wilaya: '16 - Alger',
    type: 'hackathon',
    description: '48h algorithmic challenge.',
    status: 'flagged_conflict',
    conflictContext: 'Potential schedule clash with approved event on 2026-10-15.',
  },
  event_rejected_1: {
    clubId: 'club_delta',
    clubName: 'Delta Media Society',
    title: 'Unofficial Campus Rally',
    date: '2026-12-05T10:00:00.000Z',
    endDate: '2026-12-05T12:00:00.000Z',
    location: 'Main Yard',
    wilaya: '25 - Constantine',
    type: 'cultural',
    description: 'Student gathering.',
    status: 'rejected',
    rejectionReason: 'Event lacks university administration authorization letter.',
  },
};

// Setup Firestore mock on admin instance
const mockFirestoreInstance = {
  collection: (colName: string) => {
    return {
      doc: (docId?: string) => {
        const actualId = docId || '';
        return {
          id: actualId,
          get: async () => {
            if (colName === 'events') {
              return {
                exists: !!mockEventsDb[actualId],
                id: actualId,
                data: () => mockEventsDb[actualId],
              };
            }
            return { exists: false, id: actualId, data: () => null };
          },
        };
      },
    };
  },
};

const firestoreMockFn: any = () => mockFirestoreInstance;
Object.defineProperty(admin, 'firestore', {
  value: firestoreMockFn,
  configurable: true,
  writable: true,
});

describe('Feature 7: Calendar & Server-Side ICS Export', () => {
  describe('RFC 5545 Helpers', () => {
    it('formatIcsDate converts UTC ISO string to Africa/Algiers local time (UTC+1)', () => {
      // 2026-10-15T09:00:00.000Z -> In Algiers (UTC+1) is 2026-10-15 10:00:00
      const formatted = formatIcsDate('2026-10-15T09:00:00.000Z');
      assert.strictEqual(formatted, '20261015T100000');
    });

    it('formatIcsDate handles date rolling over midnight into next day', () => {
      // 2026-10-15T23:30:00.000Z -> In Algiers (UTC+1) is 2026-10-16 00:30:00
      const formatted = formatIcsDate('2026-10-15T23:30:00.000Z');
      assert.strictEqual(formatted, '20261016T003000');
    });

    it('formatUtcDate formats timestamp with Z suffix for DTSTAMP', () => {
      const d = new Date('2026-10-15T09:00:00.000Z');
      const formatted = formatUtcDate(d);
      assert.strictEqual(formatted, '20261015T090000Z');
    });

    it('sanitizeIcsText properly escapes backslashes, semicolons, commas, and newlines', () => {
      const input = 'Hello\\World; NACS, Algeria.\nNext line\r\nThird line.';
      const sanitized = sanitizeIcsText(input);
      assert.strictEqual(sanitized, 'Hello\\\\World\\; NACS\\, Algeria.\\nNext line\\nThird line.');
    });

    it('slugify converts titles into clean file slugs', () => {
      assert.strictEqual(slugify('Autonomous Robotics Workshop 2026!'), 'autonomous-robotics-workshop-2026');
      assert.strictEqual(slugify(''), 'nacs-event');
    });
  });

  describe('Callable: exportEventIcs', () => {
    it('fails with invalid-argument when eventId is missing or blank', async () => {
      await assert.rejects(
        async () => {
          await (exportEventIcs as any).run({ data: {} });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'invalid-argument');
          assert.match(err.message, /Missing or invalid eventId parameter/);
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await (exportEventIcs as any).run({ data: { eventId: '   ' } });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'invalid-argument');
          return true;
        }
      );
    });

    it('fails with not-found when event does not exist', async () => {
      await assert.rejects(
        async () => {
          await (exportEventIcs as any).run({ data: { eventId: 'non_existent_event_id' } });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'not-found');
          assert.match(err.message, /was not found/);
          return true;
        }
      );
    });

    it('INVARIANT: refuses export with failed-precondition if event status is pending', async () => {
      await assert.rejects(
        async () => {
          await (exportEventIcs as any).run({ data: { eventId: 'event_pending_1' } });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'failed-precondition');
          assert.match(err.message, /Cannot export unapproved event.*pending/);
          return true;
        }
      );
    });

    it('INVARIANT: refuses export with failed-precondition if event status is flagged_conflict', async () => {
      await assert.rejects(
        async () => {
          await (exportEventIcs as any).run({ data: { eventId: 'event_flagged_1' } });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'failed-precondition');
          assert.match(err.message, /Cannot export unapproved event.*flagged_conflict/);
          return true;
        }
      );
    });

    it('INVARIANT: refuses export with failed-precondition if event status is rejected', async () => {
      await assert.rejects(
        async () => {
          await (exportEventIcs as any).run({ data: { eventId: 'event_rejected_1' } });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'failed-precondition');
          assert.match(err.message, /Cannot export unapproved event.*rejected/);
          return true;
        }
      );
    });

    it('SUCCESS: exports approved event as valid RFC 5545 iCalendar with Africa/Algiers timezone', async () => {
      const result = await (exportEventIcs as any).run({
        data: { eventId: 'event_approved_1' },
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.eventId, 'event_approved_1');
      assert.strictEqual(result.filename, 'autonomous-robotics-workshop.ics');

      const ics = result.icsContent;
      // Assert envelope
      assert.match(ics, /^BEGIN:VCALENDAR/);
      assert.match(ics, /VERSION:2\.0/);
      assert.match(ics, /PRODID:-\/\/National Association of Campus Societies/);
      assert.match(ics, /CALSCALE:GREGORIAN/);
      assert.match(ics, /METHOD:PUBLISH/);

      // Assert VTIMEZONE block for Africa/Algiers
      assert.match(ics, /BEGIN:VTIMEZONE/);
      assert.match(ics, /TZID:Africa\/Algiers/);
      assert.match(ics, /TZOFFSETFROM:\+0100/);
      assert.match(ics, /TZOFFSETTO:\+0100/);
      assert.match(ics, /END:VTIMEZONE/);

      // Assert VEVENT content
      assert.match(ics, /BEGIN:VEVENT/);
      assert.match(ics, /UID:event_approved_1@nacs\.dz/);
      assert.match(ics, /DTSTAMP:\d{8}T\d{6}Z/);
      // Start time: 09:00 UTC -> 10:00 Africa/Algiers
      assert.match(ics, /DTSTART;TZID=Africa\/Algiers:20261015T100000/);
      // End time: 17:00 UTC -> 18:00 Africa/Algiers
      assert.match(ics, /DTEND;TZID=Africa\/Algiers:20261015T180000/);
      assert.match(ics, /SUMMARY:Autonomous Robotics Workshop/);
      assert.match(ics, /DESCRIPTION:Hands-on session building Arduino-powered line-follower rovers\./);
      assert.match(ics, /LOCATION:Amphi D\\, Faculty of Electronics\\, 16 - Alger/);
      assert.match(ics, /ORGANIZER;CN=Alpha Robotics USTHB:mailto:events@nacs\.dz/);
      assert.match(ics, /URL:https:\/\/nacs\.dz\/calendar\?event=event_approved_1/);
      assert.match(ics, /STATUS:CONFIRMED/);
      assert.match(ics, /END:VEVENT/);
      assert.match(ics, /END:VCALENDAR\r\n$/);

      // PRIVACY INVARIANT: Ensure internal board review fields and student lead UIDs are NOT present
      assert.doesNotMatch(ics, /uid_board_officer/);
      assert.doesNotMatch(ics, /uid_student_lead/);
      assert.doesNotMatch(ics, /reviewedBy/);
      assert.doesNotMatch(ics, /createdBy/);
    });

    it('SUCCESS: escapes special characters according to RFC 5545 specifications', async () => {
      const result = await (exportEventIcs as any).run({
        data: { eventId: 'event_with_special_chars' },
      });

      assert.strictEqual(result.success, true);
      const ics = result.icsContent;

      // Check escaped title: commas, semicolons, backslashes
      assert.match(ics, /SUMMARY:Robotics\\, AI\\; Machine Learning & Vision\\\\Audio/);
      // Check escaped multiline description
      assert.match(ics, /DESCRIPTION:First line\.\\nSecond line with\\; semicolon and\\, comma\.\\nThird line with \\\\ backslash\./);
    });
  });

  describe('Callable: exportEventsIcs (Batch Export)', () => {
    it('fails with invalid-argument when eventIds array is missing or empty', async () => {
      await assert.rejects(
        async () => {
          await (exportEventsIcs as any).run({ data: { eventIds: [] } });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'invalid-argument');
          return true;
        }
      );
    });

    it('strictly excludes unapproved events and only exports approved ones', async () => {
      const result = await (exportEventsIcs as any).run({
        data: {
          eventIds: [
            'event_approved_1',
            'event_pending_1',
            'event_flagged_1',
            'event_rejected_1',
            'event_with_special_chars',
          ],
        },
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.count, 2); // Only event_approved_1 and event_with_special_chars
      assert.strictEqual(result.filename, 'nacs-national-events.ics');

      const ics = result.icsContent;
      assert.match(ics, /UID:event_approved_1@nacs\.dz/);
      assert.match(ics, /UID:event_with_special_chars@nacs\.dz/);
      assert.doesNotMatch(ics, /UID:event_pending_1@nacs\.dz/);
      assert.doesNotMatch(ics, /UID:event_flagged_1@nacs\.dz/);
      assert.doesNotMatch(ics, /UID:event_rejected_1@nacs\.dz/);
    });

    it('fails with failed-precondition if no requested event is approved', async () => {
      await assert.rejects(
        async () => {
          await (exportEventsIcs as any).run({
            data: { eventIds: ['event_pending_1', 'event_flagged_1', 'event_rejected_1'] },
          });
        },
        (err: any) => {
          assert.strictEqual(err.code, 'failed-precondition');
          assert.match(err.message, /No approved events found/);
          return true;
        }
      );
    });
  });
});
