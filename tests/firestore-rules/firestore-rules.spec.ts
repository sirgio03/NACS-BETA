import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
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
        });
        // Board user
        await db.collection('users').doc('board_user_1').set({
          role: 'board',
          email: 'board@nacs.dz',
        });
        // Regular club lead user
        await db.collection('users').doc('lead_user_1').set({
          role: 'club_lead',
          clubId: 'club_algiers_tech',
          email: 'lead@club.dz',
        });
        // Regular student user
        await db.collection('users').doc('student_user_1').set({
          role: 'student',
          email: 'student@univ.dz',
        });
      });
    }
  });

  // ===========================================================================
  // 1. CLUBS COLLECTION
  // ===========================================================================
  describe('Clubs Collection', () => {
    it('allows public read on clubs directory', async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('clubs').doc('club_1').set({
          name: 'Micro Club USTHB',
          university: 'USTHB',
          verified: true,
        });
      });

      const unauthedDb = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(unauthedDb.collection('clubs').doc('club_1').get());
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

    it('denies non-board user from reading pending event of other creators', async () => {
      const otherUserDb = testEnv.authenticatedContext('student_user_1').firestore();
      await assertFails(otherUserDb.collection('events').doc('event_pending').get());
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
      const userDb = testEnv.authenticatedContext('student_user_1').firestore();
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
        .authenticatedContext('student_user_1', { email: 'unrelated@univ.dz' })
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
  // 5. USERS COLLECTION
  // ===========================================================================
  describe('Users Collection', () => {
    it('allows owner to read their own profile', async () => {
      const ownerDb = testEnv.authenticatedContext('student_user_1').firestore();
      await assertSucceeds(ownerDb.collection('users').doc('student_user_1').get());
    });

    it('allows board member to read another user profile', async () => {
      const boardDb = testEnv.authenticatedContext('board_user_1').firestore();
      await assertSucceeds(boardDb.collection('users').doc('student_user_1').get());
    });

    it('denies regular user from reading another user profile', async () => {
      const userDb = testEnv.authenticatedContext('student_user_1').firestore();
      await assertFails(userDb.collection('users').doc('admin_user_1').get());
    });

    it('allows user to update their own profile fields (e.g. displayName)', async () => {
      const userDb = testEnv.authenticatedContext('student_user_1').firestore();
      await assertSucceeds(
        userDb.collection('users').doc('student_user_1').update({
          displayName: 'Updated Name',
        })
      );
    });

    it('strictly PREVENTS user from mutating role (privilege escalation prevention)', async () => {
      const userDb = testEnv.authenticatedContext('student_user_1').firestore();
      await assertFails(
        userDb.collection('users').doc('student_user_1').update({
          role: 'admin',
        })
      );
    });

    it('strictly PREVENTS user from mutating clubId directly', async () => {
      const userDb = testEnv.authenticatedContext('student_user_1').firestore();
      await assertFails(
        userDb.collection('users').doc('student_user_1').update({
          clubId: 'hacked_club_id',
        })
      );
    });

    it('denies client from creating a new user document directly', async () => {
      const attackerDb = testEnv.authenticatedContext('attacker').firestore();
      await assertFails(
        attackerDb.collection('users').doc('attacker').set({
          role: 'admin',
        })
      );
    });
  });
});
