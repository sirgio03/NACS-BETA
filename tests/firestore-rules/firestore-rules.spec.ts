import { describe, it, before, after, beforeEach } from 'node:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let testEnv: RulesTestEnvironment;

const PROJECT_ID = 'nacs-platform-rules-test';
const RULES_PATH = path.resolve(__dirname, '../../firestore.rules');

describe('NACS Firestore Security Rules Test Suite', () => {
  before(async () => {
    const rules = fs.readFileSync(RULES_PATH, 'utf8');
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        rules,
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (testEnv) {
      await testEnv.clearFirestore();

      // Seed initial users for role-based authorization tests
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        // Admin user
        await db.collection('users').doc('admin_user_1').set({
          role: 'admin',
          email: 'admin@nacs.dz',
          displayName: 'Admin Lead',
        });
        // Board user
        await db.collection('users').doc('board_user_1').set({
          role: 'board',
          email: 'board@nacs.dz',
          displayName: 'Board Officer',
        });
        // Regular club lead user
        await db.collection('users').doc('lead_user_1').set({
          role: 'club_lead',
          clubId: 'club_algiers_tech',
          email: 'lead@club.dz',
          displayName: 'Society President',
        });
        // Baseline visitor user (provisioned by auth trigger on first sign-in)
        await db.collection('users').doc('visitor_user_1').set({
          role: 'visitor',
          clubId: null,
          email: 'visitor@univ.dz',
          displayName: 'Student Visitor',
          bio: 'First-year computer science student.',
        });
      });
    }
  });

  // ===========================================================================
  // 1. CLUBS COLLECTION
  // ===========================================================================
  describe('Clubs Collection', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection('clubs').doc('club_verified').set({
          name: 'Micro Club USTHB',
          university: 'USTHB',
          verified: true,
        });
        await db.collection('clubs').doc('club_unverified').set({
          name: 'Pending New Club',
          university: 'ESI Algiers',
          verified: false,
        });
      });
    });

    it('allows public visitor to read verified club', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(unauthedDb.collection('clubs').doc('club_verified').get());
    });

    it('strictly DENIES unauthenticated visitor from reading unverified club (verified == false)', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(unauthedDb.collection('clubs').doc('club_unverified').get());
    });

    it('strictly DENIES regular visitor user from reading unverified club', async () => {
      const visitorDb = testEnv.authenticatedContext('visitor_user_1').firestore();
      await assertFails(visitorDb.collection('clubs').doc('club_unverified').get());
    });

    it('allows board member to read unverified club for moderation', async () => {
      const boardDb = testEnv.authenticatedContext('board_user_1').firestore();
      await assertSucceeds(boardDb.collection('clubs').doc('club_unverified').get());
    });

    it('allows admin to read unverified club for moderation', async () => {
      const adminDb = testEnv.authenticatedContext('admin_user_1').firestore();
      await assertSucceeds(adminDb.collection('clubs').doc('club_unverified').get());
    });

    it('strictly denies client direct writes to clubs', async () => {
      const authedDb = testEnv.authenticatedContext('lead_user_1').firestore();
      await assertFails(
        authedDb.collection('clubs').doc('club_new').set({
          name: 'Hacked Club',
          verified: true,
        })
      );
    });
  });

  // ===========================================================================
  // 2. EVENTS COLLECTION
  // ===========================================================================
  describe('Events Collection', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection('events').doc('event_approved').set({
          title: 'Algeria Tech Summit',
          status: 'approved',
          createdBy: 'lead_user_1',
        });
        await db.collection('events').doc('event_pending').set({
          title: 'Pending Workshop',
          status: 'pending',
          createdBy: 'lead_user_1',
        });
      });
    });

    it('allows public visitor to read approved event', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(unauthedDb.collection('events').doc('event_approved').get());
    });

    it('denies public visitor from reading pending event', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(unauthedDb.collection('events').doc('event_pending').get());
    });

    it('denies non-board visitor from reading pending event of other creators', async () => {
      const visitorDb = testEnv.authenticatedContext('visitor_user_1').firestore();
      await assertFails(visitorDb.collection('events').doc('event_pending').get());
    });

    it('allows creator to inspect their own pending event', async () => {
      const creatorDb = testEnv.authenticatedContext('lead_user_1').firestore();
      await assertSucceeds(creatorDb.collection('events').doc('event_pending').get());
    });

    it('allows board member to read pending event for moderation', async () => {
      const boardDb = testEnv.authenticatedContext('board_user_1').firestore();
      await assertSucceeds(boardDb.collection('events').doc('event_pending').get());
    });

    it('denies client direct write to events (must use Cloud Function)', async () => {
      const creatorDb = testEnv.authenticatedContext('lead_user_1').firestore();
      await assertFails(
        creatorDb.collection('events').doc('event_hack').set({
          title: 'Unauthorized Event',
          status: 'approved',
        })
      );
    });
  });

  // ===========================================================================
  // 3. PROJECTS COLLECTION
  // ===========================================================================
  describe('Projects Collection', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection('projects').doc('proj_approved').set({
          title: 'Autonomous Rover',
          status: 'approved',
          submittedBy: 'lead_user_1',
        });
        await db.collection('projects').doc('proj_pending').set({
          title: 'Under Review Drone',
          status: 'pending',
          submittedBy: 'lead_user_1',
        });
      });
    });

    it('allows public visitor to read approved project', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(unauthedDb.collection('projects').doc('proj_approved').get());
    });

    it('denies public visitor from reading pending project', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(unauthedDb.collection('projects').doc('proj_pending').get());
    });

    it('allows submitter to inspect their own pending project', async () => {
      const submitterDb = testEnv.authenticatedContext('lead_user_1').firestore();
      await assertSucceeds(submitterDb.collection('projects').doc('proj_pending').get());
    });

    it('allows admin to inspect pending project for showcase approval', async () => {
      const adminDb = testEnv.authenticatedContext('admin_user_1').firestore();
      await assertSucceeds(adminDb.collection('projects').doc('proj_pending').get());
    });

    it('denies client direct write to projects', async () => {
      const userDb = testEnv.authenticatedContext('visitor_user_1').firestore();
      await assertFails(
        userDb.collection('projects').doc('proj_new').set({
          title: 'Bypass Function Project',
          status: 'approved',
        })
      );
    });
  });

  // ===========================================================================
  // 4. APPLICATIONS COLLECTION
  // ===========================================================================
  describe('Applications Collection', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection('applications').doc('app_secret').set({
          clubName: 'Robotics Oran',
          university: 'USTO',
          contactEmail: 'applicant@usto.dz',
          status: 'pending',
        });
      });
    });

    it('denies unauthenticated visitors from reading applications', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(unauthedDb.collection('applications').doc('app_secret').get());
    });

    it('denies non-board user with different email from reading applications', async () => {
      const otherDb = testEnv
        .authenticatedContext('visitor_user_1', { email: 'unrelated@univ.dz' })
        .firestore();
      await assertFails(otherDb.collection('applications').doc('app_secret').get());
    });

    it('allows applicant matching contactEmail to read their application status', async () => {
      const applicantDb = testEnv
        .authenticatedContext('applicant_uid', { email: 'applicant@usto.dz' })
        .firestore();
      await assertSucceeds(applicantDb.collection('applications').doc('app_secret').get());
    });

    it('allows board member to read submitted application', async () => {
      const boardDb = testEnv.authenticatedContext('board_user_1').firestore();
      await assertSucceeds(boardDb.collection('applications').doc('app_secret').get());
    });

    it('denies direct client writes to applications (must submit via callable function)', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        unauthedDb.collection('applications').doc('spam_app').set({
          clubName: 'Spam Club',
        })
      );
    });
  });

  // ===========================================================================
  // 5. USERS COLLECTION (EXPLICIT ALLOWLIST & ZERO-ELEVATION GUARANTEES)
  // ===========================================================================
  describe('Users Collection', () => {
    it('allows owner to read their own profile', async () => {
      const ownerDb = testEnv.authenticatedContext('visitor_user_1').firestore();
      await assertSucceeds(ownerDb.collection('users').doc('visitor_user_1').get());
    });

    it('allows board member to read another user profile', async () => {
      const boardDb = testEnv.authenticatedContext('board_user_1').firestore();
      await assertSucceeds(boardDb.collection('users').doc('visitor_user_1').get());
    });

    it('denies regular visitor from reading another user profile', async () => {
      const userDb = testEnv.authenticatedContext('visitor_user_1').firestore();
      await assertFails(userDb.collection('users').doc('admin_user_1').get());
    });

    it('allows user to update fields in the explicit ALLOWLIST (displayName, bio, photoURL)', async () => {
      const userDb = testEnv.authenticatedContext('visitor_user_1').firestore();
      await assertSucceeds(
        userDb.collection('users').doc('visitor_user_1').update({
          displayName: 'Updated Student Name',
          bio: 'Updated bio text.',
          photoURL: 'https://example.com/avatar.jpg',
        })
      );
    });

    it('strictly PREVENTS user from mutating role (privilege escalation blocked)', async () => {
      const userDb = testEnv.authenticatedContext('visitor_user_1').firestore();
      await assertFails(
        userDb.collection('users').doc('visitor_user_1').update({
          role: 'admin',
        })
      );
    });

    it('strictly PREVENTS user from mutating clubId directly', async () => {
      const userDb = testEnv.authenticatedContext('visitor_user_1').firestore();
      await assertFails(
        userDb.collection('users').doc('visitor_user_1').update({
          clubId: 'hacked_club_id',
        })
      );
    });

    it('strictly PREVENTS user from writing unwhitelisted schema fields (default-deny)', async () => {
      const userDb = testEnv.authenticatedContext('visitor_user_1').firestore();
      await assertFails(
        userDb.collection('users').doc('visitor_user_1').update({
          isSuperuser: true,
          reputationScore: 9999,
        })
      );
    });

    it('denies client from creating a new user document directly (handled by auth trigger)', async () => {
      const attackerDb = testEnv.authenticatedContext('new_attacker').firestore();
      await assertFails(
        attackerDb.collection('users').doc('new_attacker').set({
          role: 'admin',
          email: 'attacker@bad.com',
        })
      );
    });

    it('denies client from deleting a user document', async () => {
      const userDb = testEnv.authenticatedContext('visitor_user_1').firestore();
      await assertFails(userDb.collection('users').doc('visitor_user_1').delete());
    });

    it('allows server-side admin SDK / Cloud Functions to elevate user role', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection('users').doc('visitor_user_1').update({
          role: 'board',
        });
      });

      // Verify the updated role is now reflected
      const boardDb = testEnv.authenticatedContext('admin_user_1').firestore();
      const updatedDoc = await boardDb.collection('users').doc('visitor_user_1').get();
      const data = updatedDoc.data();
      if (data?.role !== 'board') {
        throw new Error('Server-side role elevation failed.');
      }
    });
  });

  // ===========================================================================
  // 6. ROLE CHANGE LOG COLLECTION (roleChangeLog)
  // ===========================================================================
  describe('roleChangeLog Collection', () => {
    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await db.collection('roleChangeLog').doc('log_1').set({
          affectedUid: 'lead_user_1',
          previousRole: 'visitor',
          newRole: 'club_lead',
          changedBy: 'admin_user_1',
          timestamp: new Date(),
        });
      });
    });

    it('allows board member to read role change logs', async () => {
      const boardDb = testEnv.authenticatedContext('board_user_1').firestore();
      await assertSucceeds(boardDb.collection('roleChangeLog').doc('log_1').get());
    });

    it('allows admin to read role change logs', async () => {
      const adminDb = testEnv.authenticatedContext('admin_user_1').firestore();
      await assertSucceeds(adminDb.collection('roleChangeLog').doc('log_1').get());
    });

    it('denies unauthenticated visitors from reading role change logs', async () => {
      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(unauthedDb.collection('roleChangeLog').doc('log_1').get());
    });

    it('denies regular visitor user from reading role change logs', async () => {
      const visitorDb = testEnv.authenticatedContext('visitor_user_1').firestore();
      await assertFails(visitorDb.collection('roleChangeLog').doc('log_1').get());
    });

    it('strictly denies direct client writes to roleChangeLog', async () => {
      const adminDb = testEnv.authenticatedContext('admin_user_1').firestore();
      await assertFails(
        adminDb.collection('roleChangeLog').doc('forged_log').set({
          affectedUid: 'admin_user_1',
          newRole: 'admin',
        })
      );
    });
  });
});
