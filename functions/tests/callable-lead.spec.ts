import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as admin from 'firebase-admin';
import { updateClubProfile, submitEvent, submitProject } from '../src/handlers/lead';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'nacs-lead-test' });
}

// In-memory mock database for lead operations
const mockUsersDb: Record<string, { role: string; clubId: string | null; email: string }> = {
  lead_user_alpha: {
    role: 'club_lead',
    clubId: 'club_alpha',
    email: 'alpha@usthb.dz',
  },
  lead_user_beta: {
    role: 'club_lead',
    clubId: 'club_beta',
    email: 'beta@usto.dz',
  },
  visitor_user: {
    role: 'visitor',
    clubId: null,
    email: 'visitor@univ.dz',
  },
};

const mockClubsDb: Record<string, any> = {
  club_alpha: {
    name: 'Alpha Robotics USTHB',
    university: 'USTHB',
    category: 'tech',
    foundingDate: '2022-01-01',
    verified: true,
    description: 'Original Alpha Description',
    logoUrl: 'https://example.com/alpha.png',
    socials: {},
    leadership: [{ name: 'Amine', role: 'President' }],
  },
  club_beta: {
    name: 'Beta Biotech USTO',
    university: 'USTO',
    category: 'scientific',
    foundingDate: '2023-01-01',
    verified: true,
    description: 'Original Beta Description',
  },
};

const mockApprovedEvents: Array<{ id: string; data: any }> = [
  {
    id: 'approved_summit_1',
    data: {
      title: 'National Robotics Summit',
      status: 'approved',
      date: '2026-10-15T10:00:00.000Z',
      endDate: '2026-10-15T18:00:00.000Z',
      location: 'Algiers',
    },
  },
];

const mockEventsCreated: any[] = [];
const mockProjectsCreated: any[] = [];

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
            if (colName === 'clubs') {
              return { exists: !!mockClubsDb[actualId], data: () => mockClubsDb[actualId] };
            }
            return { exists: false, data: () => null };
          },
          update: async (updates: any) => {
            if (colName === 'clubs' && mockClubsDb[actualId]) {
              Object.assign(mockClubsDb[actualId], updates);
            }
          },
        };
      },
      add: async (data: any) => {
        const newId = `new_${Math.random().toString(36).substring(7)}`;
        if (colName === 'events') {
          mockEventsCreated.push({ id: newId, ...data });
        }
        if (colName === 'projects') {
          mockProjectsCreated.push({ id: newId, ...data });
        }
        return { id: newId };
      },
      where: (field: string, op: string, val: any) => {
        // Query builder for conflict detection
        let filtered = [...mockApprovedEvents];
        const queryObj = {
          where: (f2: string, op2: string, v2: any) => {
            if (f2 === 'date' && op2 === '>=') {
              filtered = filtered.filter((e) => e.data.date >= v2);
            }
            if (f2 === 'date' && op2 === '<=') {
              filtered = filtered.filter((e) => e.data.date <= v2);
            }
            return queryObj;
          },
          get: async () => {
            return {
              empty: filtered.length === 0,
              size: filtered.length,
              docs: filtered.map((e) => ({
                id: e.id,
                data: () => e.data,
              })),
            };
          },
        };

        if (field === 'status' && op === '==' && val === 'approved') {
          filtered = filtered.filter((e) => e.data.status === 'approved');
        }
        return queryObj;
      },
    };
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

describe('Club Lead Functions Suite', () => {
  // =========================================================================
  // 1. updateClubProfile Tests
  // =========================================================================
  describe('updateClubProfile', () => {
    it('rejects attempt when a club lead tries to update a DIFFERENT club', async () => {
      await assert.rejects(
        async () => {
          await updateClubProfile.run({
            data: {
              clubId: 'club_beta', // Attempting to update Beta
              description: 'Malicious overwrite by Alpha lead',
            },
            auth: { uid: 'lead_user_alpha', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          assert.match(err.message, /Caller does not have permission to manage this club/);
          return true;
        }
      );
    });

    it('rejects attempt when caller is not a verified club lead', async () => {
      await assert.rejects(
        async () => {
          await updateClubProfile.run({
            data: {
              clubId: 'club_alpha',
              description: 'Visitor edit attempt',
            },
            auth: { uid: 'visitor_user', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          assert.match(err.message, /User is not authorized as a verified club lead/);
          return true;
        }
      );
    });

    it('rejects write attempt to non-allowlisted field: verified', async () => {
      await assert.rejects(
        async () => {
          await updateClubProfile.run({
            data: {
              clubId: 'club_alpha',
              verified: true, // Non-allowlisted
            },
            auth: { uid: 'lead_user_alpha', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'invalid-argument');
          assert.match(err.message, /Field 'verified' is protected or non-allowlisted/);
          return true;
        }
      );
    });

    it('rejects write attempt to non-allowlisted field: foundingDate', async () => {
      await assert.rejects(
        async () => {
          await updateClubProfile.run({
            data: {
              clubId: 'club_alpha',
              foundingDate: '1999-01-01', // Non-allowlisted
            },
            auth: { uid: 'lead_user_alpha', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'invalid-argument');
          assert.match(err.message, /Field 'foundingDate' is protected or non-allowlisted/);
          return true;
        }
      );
    });

    it('rejects write attempt to non-allowlisted field: name', async () => {
      await assert.rejects(
        async () => {
          await updateClubProfile.run({
            data: {
              clubId: 'club_alpha',
              name: 'Renamed Club Without Board Approval',
            },
            auth: { uid: 'lead_user_alpha', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'invalid-argument');
          assert.match(err.message, /Field 'name' is protected or non-allowlisted/);
          return true;
        }
      );
    });

    it('rejects leadership update containing forbidden uid or email (privacy invariant)', async () => {
      await assert.rejects(
        async () => {
          await updateClubProfile.run({
            data: {
              clubId: 'club_alpha',
              leadership: [
                { name: 'Samir', role: 'VP', uid: 'leaked_uid' } as any,
              ],
            },
            auth: { uid: 'lead_user_alpha', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'invalid-argument');
          assert.match(err.message, /Leadership entries cannot contain uid or email/);
          return true;
        }
      );
    });

    it('allows valid update to own club with allowlisted fields', async () => {
      const result = await updateClubProfile.run({
        data: {
          clubId: 'club_alpha',
          description: 'Updated innovative robotics student society bio.',
          logoUrl: 'https://example.com/new-logo.png',
          socials: { github: 'https://github.com/alpharobotics' },
          leadership: [
            { name: 'Amine Benali', role: 'President' },
            { name: 'Sarah K.', role: 'Technical Lead' },
          ],
        },
        auth: { uid: 'lead_user_alpha', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.clubId, 'club_alpha');
      assert.strictEqual(mockClubsDb.club_alpha.description, 'Updated innovative robotics student society bio.');
      assert.strictEqual(mockClubsDb.club_alpha.leadership.length, 2);
    });
  });

  // =========================================================================
  // 2. submitEvent Tests (including 3-day conflict detection)
  // =========================================================================
  describe('submitEvent', () => {
    it('rejects event submission if lead attempts to submit for another club', async () => {
      await assert.rejects(
        async () => {
          await submitEvent.run({
            data: {
              clubId: 'club_beta',
              title: 'Alpha Hackathon',
              date: '2026-11-01T09:00:00.000Z',
              endDate: '2026-11-01T18:00:00.000Z',
              location: 'USTHB Campus',
              type: 'hackathon',
              description: 'Annual competitive programming hackathon.',
            },
            auth: { uid: 'lead_user_alpha', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          return true;
        }
      );
    });

    it('correctly FLAGS an event submitted within 3 days of an approved event (flagged_conflict)', async () => {
      // Approved summit is scheduled on 2026-10-15T10:00:00.000Z
      // Submitted event is on 2026-10-16 (+1 day, within +/- 3 day window)
      const result = await submitEvent.run({
        data: {
          clubId: 'club_alpha',
          title: 'Robotics Workshop Day',
          date: '2026-10-16T09:00:00.000Z',
          endDate: '2026-10-16T17:00:00.000Z',
          location: 'Lab 4, USTHB',
          type: 'workshop',
          description: 'Hands-on embedded systems workshop.',
        },
        auth: { uid: 'lead_user_alpha', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'flagged_conflict');
      assert.ok(result.conflictContext);
      assert.match(result.conflictContext, /Potential schedule clash with approved event/);
      assert.match(result.conflictContext, /National Robotics Summit/);
    });

    it('sets status to pending when NO approved events exist within +/- 3 days', async () => {
      // Submitted date 2026-11-25 is far away from 2026-10-15
      const result = await submitEvent.run({
        data: {
          clubId: 'club_alpha',
          title: 'Autonomous Drone Demo',
          date: '2026-11-25T10:00:00.000Z',
          endDate: '2026-11-25T16:00:00.000Z',
          location: 'Auditorium USTO',
          type: 'conference',
          description: 'Showcase of autonomous aerial navigation systems.',
        },
        auth: { uid: 'lead_user_alpha', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'pending');
      assert.strictEqual(result.conflictContext, null);
    });
  });

  // =========================================================================
  // 3. submitProject Tests
  // =========================================================================
  describe('submitProject', () => {
    it('rejects project submission if lead attempts to submit for another club', async () => {
      await assert.rejects(
        async () => {
          await submitProject.run({
            data: {
              clubId: 'club_beta',
              title: 'AI Soil Scanner',
              team: ['Nadia', 'Karim'],
              description: 'Computer vision soil nutrient analyzer for agriculture.',
              tags: ['ai', 'iot', 'agriculture'],
              imageUrls: [],
            },
            auth: { uid: 'lead_user_alpha', token: {} } as any,
          } as any);
        },
        (err: any) => {
          assert.strictEqual(err.code, 'permission-denied');
          return true;
        }
      );
    });

    it('creates project with pending status when valid data is submitted', async () => {
      const result = await submitProject.run({
        data: {
          clubId: 'club_alpha',
          title: 'Autonomous Solar Rover',
          team: ['Yacine M.', 'Lina B.'],
          description: 'Autonomous exploration rover with solar charging and lidar mapping.',
          tags: ['robotics', 'lidar', 'solar'],
          imageUrls: ['https://example.com/rover1.png'],
          links: { github: 'https://github.com/alpharobotics/solar-rover' },
        },
        auth: { uid: 'lead_user_alpha', token: {} } as any,
      } as any);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'pending');
      assert.ok(result.projectId);
    });
  });
});
