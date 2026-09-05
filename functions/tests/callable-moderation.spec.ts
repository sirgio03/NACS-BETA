import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as admin from 'firebase-admin';
import { approveEvent, rejectEvent, approveProject, rejectProject } from '../src/handlers/moderation';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'nacs-moderation-test' });
}

// In-memory mock users database
const mockUsersDb: Record<string, { role: string; email: string; displayName: string }> = {
  board_user: {
    role: 'board',
    email: 'board@nacs.dz',
    displayName: 'Board Officer',
  },
  admin_user: {
    role: 'admin',
    email: 'admin@nacs.dz',
    displayName: 'Platform Admin',
  },
  lead_user: {
    role: 'club_lead',
    email: 'lead@club.dz',
    displayName: 'Club Lead',
  },
  visitor_user: {
    role: 'visitor',
    email: 'visitor@univ.dz',
    displayName: 'Public Visitor',
  },
};

// In-memory mock events database
const mockEventsDb: Record<string, any> = {
  event_pending_1: {
    clubId: 'club_alpha',
    clubName: 'Alpha Robotics USTHB',
    title: 'Autonomous Robotics Workshop',
    date: '2026-11-10T10:00:00.000Z',
    status: 'pending',
    conflictContext: null,
  },
  event_flagged_1: {
    clubId: 'club_beta',
    clubName: 'Beta Biotech USTO',
    title: 'National Biotech Summit',
    date: '2026-10-15T09:00:00.000Z',
    status: 'flagged_conflict',
    conflictContext: 'Potential schedule clash with approved event on 2026-10-15 (+/- 3 days).',
  },
  event_already_approved: {
    clubId: 'club_alpha',
    clubName: 'Alpha Robotics USTHB',
    title: 'AI DevFest',
    date: '2026-12-01T09:00:00.000Z',
    status: 'approved',
  },
};

// In-memory mock projects database
const mockProjectsDb: Record<string, any> = {
  project_pending_1: {
    clubId: 'club_alpha',
    clubName: 'Alpha Robotics USTHB',
    title: 'Lidar Terrain Mapping Rover',
    team: ['Yacine M.', 'Lina B.'],
    description: 'Autonomous exploration rover with lidar mapping and solar charging.',
    tags: ['robotics', 'lidar'],
    status: 'pending',
  },
  project_already_approved: {
    clubId: 'club_beta',
    clubName: 'Beta Biotech USTO',
    title: 'Microbial Fuel Cell',
    team: ['Amel K.'],
    description: 'Clean energy generation from organic wastewater.',
    tags: ['biotech', 'clean-energy'],
    status: 'approved',
  },
};

// In-memory audit log store
const mockModerationLogs: any[] = [];

// Setup Firestore mock on admin instance
const mockFirestoreInstance = {
  collection: (colName: string) => {
    return {
      doc: (docId?: string) => {
        const actualId = docId || `gen_${Math.random().toString(36).substring(7)}`;
        return {
          id: actualId,
          get: async () => {
            if (colName === 'users') {
              return { exists: !!mockUsersDb[actualId], data: () => mockUsersDb[actualId] };
            }
            if (colName === 'events') {
              return { exists: !!mockEventsDb[actualId], data: () => mockEventsDb[actualId] };
            }
            if (colName === 'projects') {
              return { exists: !!mockProjectsDb[actualId], data: () => mockProjectsDb[actualId] };
            }
            return { exists: false, data: () => null };
          },
        };
      },
    };
  },
  runTransaction: async (updateFunction: (transaction: any) => Promise<any>) => {
    const mockTransaction = {
      get: async (docRef: any) => {
        const docId = docRef.id;
        if (mockUsersDb[docId]) {
          return { exists: true, data: () => ({ ...mockUsersDb[docId] }) };
        }
        if (mockEventsDb[docId]) {
          return { exists: true, data: () => ({ ...mockEventsDb[docId] }) };
        }
        if (mockProjectsDb[docId]) {
          return { exists: true, data: () => ({ ...mockProjectsDb[docId] }) };
        }
        return { exists: false, data: () => null };
      },
      update: (docRef: any, updates: any) => {
        const docId = docRef.id;
        if (mockEventsDb[docId]) {
          Object.assign(mockEventsDb[docId], updates);
        }
        if (mockProjectsDb[docId]) {
          Object.assign(mockProjectsDb[docId], updates);
        }
      },
      set: (docRef: any, data: any) => {
        mockModerationLogs.push({ id: docRef.id, ...data });
      },
    };
    return await updateFunction(mockTransaction);
  },
};

const firestoreMockFn: any = () => mockFirestoreInstance;
firestoreMockFn.FieldValue = {
  serverTimestamp: () => new Date('2026-09-06T12:00:00.000Z'),
};

Object.defineProperty(admin, 'firestore', {
  value: firestoreMockFn,
  configurable: true,
  writable: true,
});

describe('Feature 6: Moderation Callables Test Suite', () => {
  // =========================================================================
  // 1. approveEvent Tests
  // =========================================================================
  describe('approveEvent', () => {
    it('rejects unauthenticated caller with unauthenticated error', async () => {
      await assert.rejects(
        async () => {
          await approveEvent.run({
            data: { eventId: 'event_pending_1' },
            auth: undefined,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'unauthenticated');
          return true;
        }
      );
    });

    it('rejects non-board/admin caller (club_lead or visitor) with permission-denied', async () => {
      await assert.rejects(
        async () => {
          await approveEvent.run({
            data: { eventId: 'event_pending_1' },
            auth: { uid: 'lead_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await approveEvent.run({
            data: { eventId: 'event_pending_1' },
            auth: { uid: 'visitor_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          return true;
        }
      );
    });

    it('rejects approval if event is already approved (failed-precondition)', async () => {
      await assert.rejects(
        async () => {
          await approveEvent.run({
            data: { eventId: 'event_already_approved' },
            auth: { uid: 'board_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'failed-precondition');
          return true;
        }
      );
    });

    it('successfully approves a pending event and writes audit log', async () => {
      const result = await approveEvent.run({
        data: { eventId: 'event_pending_1' },
        auth: { uid: 'board_user', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'approved');
      assert.strictEqual(mockEventsDb.event_pending_1.status, 'approved');
      assert.strictEqual(mockEventsDb.event_pending_1.reviewedBy, 'board_user');

      // Audit log entry verified
      const log = mockModerationLogs.find(
        (l) => l.targetId === 'event_pending_1' && l.decision === 'approved'
      );
      assert.ok(log, 'Moderation audit log must be written');
      assert.strictEqual(log.targetType, 'event');
      assert.strictEqual(log.decidedBy, 'board_user');
    });

    it('successfully approves a flagged_conflict event (Board conflict resolution policy)', async () => {
      const result = await approveEvent.run({
        data: { eventId: 'event_flagged_1' },
        auth: { uid: 'board_user', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'approved');
      assert.strictEqual(mockEventsDb.event_flagged_1.status, 'approved');
      assert.strictEqual(mockEventsDb.event_flagged_1.reviewedBy, 'board_user');

      // Audit log explains board conflict resolution
      const log = mockModerationLogs.find(
        (l) => l.targetId === 'event_flagged_1' && l.decision === 'approved'
      );
      assert.ok(log);
      assert.match(log.reason, /Board resolved and approved event despite schedule proximity flag/);
    });
  });

  // =========================================================================
  // 2. rejectEvent Tests
  // =========================================================================
  describe('rejectEvent', () => {
    it('rejects non-board/admin caller with permission-denied', async () => {
      await assert.rejects(
        async () => {
          await rejectEvent.run({
            data: { eventId: 'event_pending_1', reason: 'Invalid details' },
            auth: { uid: 'visitor_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          return true;
        }
      );
    });

    it('rejects attempt to reject event with empty or whitespace-only reason', async () => {
      await assert.rejects(
        async () => {
          await rejectEvent.run({
            data: { eventId: 'event_pending_1', reason: '   ' },
            auth: { uid: 'board_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'invalid-argument');
          assert.match(err.message, /A clear justification reason is strictly mandatory/);
          return true;
        }
      );
    });

    it('successfully rejects an event with mandatory reason and writes audit log', async () => {
      // Re-seed a pending event for rejection
      mockEventsDb.event_reject_test = {
        clubId: 'club_alpha',
        clubName: 'Alpha Robotics',
        title: 'Dubious Workshop',
        status: 'pending',
      };

      const result = await rejectEvent.run({
        data: {
          eventId: 'event_reject_test',
          reason: 'Venue safety permits missing from university administration.',
        },
        auth: { uid: 'board_user', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'rejected');
      assert.strictEqual(mockEventsDb.event_reject_test.status, 'rejected');
      assert.strictEqual(
        mockEventsDb.event_reject_test.rejectionReason,
        'Venue safety permits missing from university administration.'
      );

      const log = mockModerationLogs.find(
        (l) => l.targetId === 'event_reject_test' && l.decision === 'rejected'
      );
      assert.ok(log);
      assert.strictEqual(log.reason, 'Venue safety permits missing from university administration.');
    });
  });

  // =========================================================================
  // 3. approveProject Tests
  // =========================================================================
  describe('approveProject', () => {
    it('rejects non-board/admin caller with permission-denied', async () => {
      await assert.rejects(
        async () => {
          await approveProject.run({
            data: { projectId: 'project_pending_1' },
            auth: { uid: 'visitor_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          return true;
        }
      );
    });

    it('successfully approves a pending student project and writes audit log', async () => {
      const result = await approveProject.run({
        data: { projectId: 'project_pending_1' },
        auth: { uid: 'board_user', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'approved');
      assert.strictEqual(mockProjectsDb.project_pending_1.status, 'approved');
      assert.strictEqual(mockProjectsDb.project_pending_1.reviewedBy, 'board_user');

      const log = mockModerationLogs.find(
        (l) => l.targetId === 'project_pending_1' && l.decision === 'approved'
      );
      assert.ok(log);
      assert.strictEqual(log.targetType, 'project');
      assert.strictEqual(log.decidedBy, 'board_user');
    });

    it('rejects approval if project is already approved (failed-precondition)', async () => {
      await assert.rejects(
        async () => {
          await approveProject.run({
            data: { projectId: 'project_already_approved' },
            auth: { uid: 'board_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'failed-precondition');
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 4. rejectProject Tests
  // =========================================================================
  describe('rejectProject', () => {
    it('rejects attempt to reject project with missing or whitespace reason', async () => {
      await assert.rejects(
        async () => {
          await rejectProject.run({
            data: { projectId: 'project_pending_1', reason: '' },
            auth: { uid: 'board_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'invalid-argument');
          assert.match(err.message, /A clear justification reason is strictly mandatory/);
          return true;
        }
      );
    });

    it('successfully rejects a project with mandatory reason and writes audit log', async () => {
      // Re-seed a pending project for rejection
      mockProjectsDb.project_reject_test = {
        clubId: 'club_beta',
        clubName: 'Beta Biotech',
        title: 'Unverified DNA Extraction',
        team: ['Student A'],
        status: 'pending',
      };

      const result = await rejectProject.run({
        data: {
          projectId: 'project_reject_test',
          reason: 'Incomplete project description and lacks verifiable student documentation.',
        },
        auth: { uid: 'board_user', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'rejected');
      assert.strictEqual(mockProjectsDb.project_reject_test.status, 'rejected');
      assert.strictEqual(
        mockProjectsDb.project_reject_test.rejectionReason,
        'Incomplete project description and lacks verifiable student documentation.'
      );

      const log = mockModerationLogs.find(
        (l) => l.targetId === 'project_reject_test' && l.decision === 'rejected'
      );
      assert.ok(log);
      assert.strictEqual(
        log.reason,
        'Incomplete project description and lacks verifiable student documentation.'
      );
    });
  });
});
