import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import * as admin from 'firebase-admin';
import { getWilayaReachStats } from '../src/handlers/map';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'nacs-map-test' });
}

// In-memory mock data
const mockClubs = [
  { id: 'c1', name: 'Alpha Robotics', verified: true, wilaya: '16 - Alger' },
  { id: 'c2', name: 'ESI ByteCraft', verified: true, wilaya: '16' },
  { id: 'c3', name: 'Beta Biotech', verified: true, wilaya: '31 - Oran' },
  { id: 'c4', name: 'Unverified Club', verified: false, wilaya: '25 - Constantine' },
];

const mockEvents = [
  { id: 'e1', title: 'Hackathon 16', status: 'approved', date: new Date().toISOString(), wilaya: '16 - Alger' },
  { id: 'e2', title: 'Tech Talk Oran', status: 'approved', date: new Date().toISOString(), wilaya: '31 - Oran' },
  { id: 'e3', title: 'Pending Event', status: 'pending', date: new Date().toISOString(), wilaya: '16 - Alger' },
];

const mockFirestoreInstance = {
  collection: (colName: string) => ({
    where: (field: string, op: string, val: any) => ({
      where: (f2: string, op2: string, v2: any) => ({
        get: async () => {
          if (colName === 'events') {
            const filtered = mockEvents.filter((e) => e.status === val && e.date >= v2);
            return {
              forEach: (cb: any) => filtered.forEach((d) => cb({ data: () => d, id: d.id })),
            };
          }
          return { forEach: () => {} };
        },
      }),
      get: async () => {
        if (colName === 'clubs') {
          const filtered = mockClubs.filter((c) => c.verified === val);
          return {
            forEach: (cb: any) => filtered.forEach((d) => cb({ data: () => d, id: d.id })),
          };
        }
        return { forEach: () => {} };
      },
    }),
  }),
};

const firestoreMockFn: any = () => mockFirestoreInstance;
Object.defineProperty(admin, 'firestore', {
  value: firestoreMockFn,
  configurable: true,
  writable: true,
});

describe('Feature: Wilaya Reach Statistics Cloud Function', () => {
  it('aggregates verified clubs and approved events correctly by wilaya', async () => {
    const handler = (getWilayaReachStats as any).run;
    const result = await handler({ auth: null });

    assert.ok(result);
    assert.ok(result.stats);
    assert.strictEqual(result.totalVerifiedClubs, 3);
    assert.strictEqual(result.totalUpcomingEvents, 2);

    // Alger (16) should have 2 verified clubs and 1 approved event
    const alger = result.stats['16'];
    assert.ok(alger);
    assert.strictEqual(alger.code, '16');
    assert.strictEqual(alger.clubCount, 2);
    assert.strictEqual(alger.eventCount, 1);
    assert.strictEqual(alger.hasUpcomingWithin7Days, true);

    // Oran (31) should have 1 verified club and 1 approved event
    const oran = result.stats['31'];
    assert.ok(oran);
    assert.strictEqual(oran.code, '31');
    assert.strictEqual(oran.clubCount, 1);
    assert.strictEqual(oran.eventCount, 1);

    // Active wilayas count should be 2 (16 and 31)
    assert.strictEqual(result.activeWilayasCount, 2);
  });
});
