import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as admin from 'firebase-admin';
import { approveApplication, rejectApplication } from '../src/handlers/applications';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'nacs-functions-test' });
}

// In-memory mock Firestore user collection for caller role validation
const mockUsersDb: Record<string, { role: string; email: string; displayName: string }> = {
  admin_user: {
    role: 'admin',
    email: 'admin@nacs.dz',
    displayName: 'Admin User',
  },
  board_user: {
    role: 'board',
    email: 'board@nacs.dz',
    displayName: 'Board Officer',
  },
  club_lead_user: {
    role: 'club_lead',
    email: 'lead@club.dz',
    displayName: 'Club Lead User',
  },
  visitor_user: {
    role: 'visitor',
    email: 'visitor@univ.dz',
    displayName: 'Student Visitor',
  },
};

// In-memory mock applications collection
const mockApplicationsDb: Record<string, any> = {
  app_pending_1: {
    clubName: 'Algiers Robotics Club',
    university: 'USTHB',
    contactEmail: 'robotics@usthb.dz',
    status: 'pending',
    submittedData: {
      category: 'tech',
      description: 'Robotics and automation student society.',
      leadName: 'Karim',
      leadUid: 'visitor_user',
    },
  },
};

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
            if (colName === 'applications') {
              return { exists: !!mockApplicationsDb[actualId], data: () => mockApplicationsDb[actualId] };
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
        if (mockApplicationsDb[docId]) {
          return { exists: true, data: () => mockApplicationsDb[docId] };
        }
        if (mockUsersDb[docId]) {
          return { exists: true, data: () => mockUsersDb[docId] };
        }
        return { exists: false, data: () => null };
      },
      update: (_ref: any, _data: any) => {},
      set: (_ref: any, _data: any) => {},
    };
    return await updateFunction(mockTransaction);
  },
};

const firestoreMockFn: any = () => mockFirestoreInstance;
firestoreMockFn.FieldValue = {
  serverTimestamp: () => new Date(),
};

Object.defineProperty(admin, 'firestore', {
  value: firestoreMockFn,
  configurable: true,
  writable: true,
});

describe('Callable Functions Authorization Suite', () => {
  // =========================================================================
  // 1. rejectApplication Authorization Tests
  // =========================================================================
  describe('rejectApplication Authorization', () => {
    it('throws unauthenticated error when called without auth context', async () => {
      await assert.rejects(
        async () => {
          await rejectApplication.run({
            data: { applicationId: 'app_pending_1', reason: 'Invalid documentation' },
            auth: undefined,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'unauthenticated');
          return true;
        }
      );
    });

    it('throws permission-denied error when called by non-existent user profile', async () => {
      await assert.rejects(
        async () => {
          await rejectApplication.run({
            data: { applicationId: 'app_pending_1', reason: 'Invalid documentation' },
            auth: { uid: 'non_existent_uid', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          assert.match(err.message, /User profile not found/);
          return true;
        }
      );
    });

    it('throws permission-denied error when called by a regular visitor user', async () => {
      await assert.rejects(
        async () => {
          await rejectApplication.run({
            data: { applicationId: 'app_pending_1', reason: 'Unauthorized attempt to reject' },
            auth: { uid: 'visitor_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          assert.match(err.message, /User is not authorized for board\/admin operations/);
          return true;
        }
      );
    });

    it('throws permission-denied error when called by a club_lead user', async () => {
      await assert.rejects(
        async () => {
          await rejectApplication.run({
            data: { applicationId: 'app_pending_1', reason: 'Unauthorized peer rejection' },
            auth: { uid: 'club_lead_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          assert.match(err.message, /User is not authorized for board\/admin operations/);
          return true;
        }
      );
    });

    it('allows board member caller to proceed past authorization', async () => {
      const result = await rejectApplication.run({
        data: { applicationId: 'app_pending_1', reason: 'Insufficient university affiliation proof' },
        auth: { uid: 'board_user', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.applicationId, 'app_pending_1');
      assert.strictEqual(result.reason, 'Insufficient university affiliation proof');
    });

    it('allows admin caller to proceed past authorization', async () => {
      const result = await rejectApplication.run({
        data: { applicationId: 'app_pending_1', reason: 'Duplicate society record' },
        auth: { uid: 'admin_user', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.applicationId, 'app_pending_1');
    });
  });

  // =========================================================================
  // 2. approveApplication Authorization Tests
  // =========================================================================
  describe('approveApplication Authorization', () => {
    it('throws unauthenticated error when called without auth context', async () => {
      await assert.rejects(
        async () => {
          await approveApplication.run({
            data: { applicationId: 'app_pending_1' },
            auth: undefined,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'unauthenticated');
          return true;
        }
      );
    });

    it('throws permission-denied error when called by non-existent user profile', async () => {
      await assert.rejects(
        async () => {
          await approveApplication.run({
            data: { applicationId: 'app_pending_1' },
            auth: { uid: 'non_existent_uid', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          assert.match(err.message, /User profile not found/);
          return true;
        }
      );
    });

    it('throws permission-denied error when called by a regular visitor user', async () => {
      await assert.rejects(
        async () => {
          await approveApplication.run({
            data: { applicationId: 'app_pending_1' },
            auth: { uid: 'visitor_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          assert.match(err.message, /User is not authorized for board\/admin operations/);
          return true;
        }
      );
    });

    it('throws permission-denied error when called by a club_lead user', async () => {
      await assert.rejects(
        async () => {
          await approveApplication.run({
            data: { applicationId: 'app_pending_1' },
            auth: { uid: 'club_lead_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          assert.match(err.message, /User is not authorized for board\/admin operations/);
          return true;
        }
      );
    });

    it('allows board member caller to proceed past authorization', async () => {
      const result = await approveApplication.run({
        data: { applicationId: 'app_pending_1' },
        auth: { uid: 'board_user', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.match(result.message, /approved successfully/);
    });

    it('allows admin caller to proceed past authorization', async () => {
      const result = await approveApplication.run({
        data: { applicationId: 'app_pending_1' },
        auth: { uid: 'admin_user', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.match(result.message, /approved successfully/);
    });
  });
});
