import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyBoardOrAdmin } from '../middleware/auth';

export interface ApplicationPayload {
  clubName: string;
  university: string;
  contactEmail: string;
  submittedData: {
    category: 'tech' | 'scientific' | 'cultural' | 'entrepreneurship' | 'general';
    description: string;
    foundingDate: string;
    leadName: string;
    leadUid?: string;
    leadPhone?: string;
    socials?: Record<string, string>;
  };
}

/**
 * Public submission endpoint for club federation membership applications.
 * Enforces Firebase App Check to prevent bot spam, automated DDoS, and form abuse.
 */
export const submitApplication = onCall<ApplicationPayload>(
  {
    enforceAppCheck: true,
  },
  async (request) => {
    const data = request.data;

    // Server-side validation
    if (!data.clubName || data.clubName.trim().length < 2) {
      throw new HttpsError('invalid-argument', 'Club name must be at least 2 characters long.');
    }
    if (!data.university || data.university.trim().length < 3) {
      throw new HttpsError('invalid-argument', 'University name must be at least 3 characters long.');
    }
    if (!data.contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail)) {
      throw new HttpsError('invalid-argument', 'A valid contact email address is required.');
    }
    if (!data.submittedData || !data.submittedData.description) {
      throw new HttpsError('invalid-argument', 'Application description is required.');
    }

    const db = admin.firestore();

    const applicationRef = await db.collection('applications').add({
      clubName: data.clubName.trim(),
      university: data.university.trim(),
      contactEmail: data.contactEmail.trim().toLowerCase(),
      status: 'pending',
      submittedData: {
        category: data.submittedData.category || 'general',
        description: data.submittedData.description.trim(),
        foundingDate: data.submittedData.foundingDate || '',
        leadName: data.submittedData.leadName || '',
        leadUid: data.submittedData.leadUid || (request.auth ? request.auth.uid : ''),
        leadPhone: data.submittedData.leadPhone || '',
        socials: data.submittedData.socials || {},
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      applicationId: applicationRef.id,
      message: 'Application submitted successfully and is pending board review.',
    };
  }
);

export interface ApproveApplicationPayload {
  applicationId: string;
}

/**
 * Board / Admin endpoint to approve club applications.
 * Executes an ATOMIC Firestore transaction that reads the application state inside
 * the transaction to eliminate race conditions, creates the club record, and provisions the club lead role.
 */
export const approveApplication = onCall<ApproveApplicationPayload>(
  async (request) => {
    // 1. Authorize: requester must be a board member or platform admin
    await verifyBoardOrAdmin(request.auth);

    const { applicationId } = request.data;
    if (!applicationId) {
      throw new HttpsError('invalid-argument', 'Missing applicationId parameter.');
    }

    const db = admin.firestore();
    const appRef = db.collection('applications').doc(applicationId);
    const newClubRef = db.collection('clubs').doc();

    const result = await db.runTransaction(async (transaction) => {
      // 2. Read inside the transaction body to guarantee consistency against concurrent reviews
      const appSnapshot = await transaction.get(appRef);
      if (!appSnapshot.exists) {
        throw new HttpsError('not-found', `Application ${applicationId} not found.`);
      }

      const appData = appSnapshot.data();
      if (!appData) {
        throw new HttpsError('internal', 'Unable to retrieve application data.');
      }

      if (appData.status !== 'pending') {
        throw new HttpsError(
          'failed-precondition',
          `Application cannot be approved; current status is '${appData.status}'.`
        );
      }

      const leadUid = appData.submittedData?.leadUid || '';

      // 3. Atomic step A: Update application status to 'approved'
      transaction.update(appRef, {
        status: 'approved',
        reviewedBy: request.auth!.uid,
        reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 4. Atomic step B: Create the verified club document
      transaction.set(newClubRef, {
        name: appData.clubName,
        university: appData.university,
        foundingDate: appData.submittedData?.foundingDate || '',
        category: appData.submittedData?.category || 'general',
        description: appData.submittedData?.description || '',
        logoUrl: '',
        verified: true,
        leadership: [
          {
            name: appData.submittedData?.leadName || 'Club Lead',
            role: 'President / Lead',
            uid: leadUid,
          },
        ],
        socials: appData.submittedData?.socials || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5. Atomic step C: Elevate club lead user profile if leadUid is provided
      if (leadUid) {
        const userRef = db.collection('users').doc(leadUid);
        transaction.set(
          userRef,
          {
            role: 'club_lead',
            clubId: newClubRef.id,
            email: appData.contactEmail,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      return {
        clubId: newClubRef.id,
        leadUid,
      };
    });

    return {
      success: true,
      message: 'Application approved successfully and club provisioned.',
      clubId: result.clubId,
      leadUid: result.leadUid,
    };
  }
);
