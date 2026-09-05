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
 * Executes an ATOMIC Firestore transaction that:
 * 1. Validates application is currently 'pending' inside the transaction.
 * 2. Updates application status to 'approved'.
 * 3. Creates the verified club record (storing strictly name & role in leadership, NO uid/email).
 * 4. Provisions the club lead role in users/{leadUid}.
 * 5. Writes an immutable audit record to roleChangeLog and applicationDecisionLog.
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
    const decisionLogRef = db.collection('applicationDecisionLog').doc();

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
      // PRIVACY SAFEGUARD: Leadership stores strictly name & role.
      // uid and email are completely excluded from the stored club document.
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
          },
        ],
        socials: appData.submittedData?.socials || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 5. Atomic step C: Elevate club lead user profile and write governance audit log
      if (leadUid) {
        const userRef = db.collection('users').doc(leadUid);
        const userSnapshot = await transaction.get(userRef);
        const previousRole = userSnapshot.exists ? (userSnapshot.data()?.role || 'visitor') : 'visitor';

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

        // Governance accountability audit trail for role change
        const auditLogRef = db.collection('roleChangeLog').doc();
        transaction.set(auditLogRef, {
          affectedUid: leadUid,
          previousRole,
          newRole: 'club_lead',
          changedBy: request.auth!.uid,
          clubId: newClubRef.id,
          reason: 'application_approval',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // 6. Atomic step D: Record application decision in applicationDecisionLog
      transaction.set(decisionLogRef, {
        applicationId,
        decidedBy: request.auth!.uid,
        decision: 'approved',
        reason: 'Meets federation criteria and university verification requirements.',
        clubName: appData.clubName,
        university: appData.university,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        clubId: newClubRef.id,
        leadUid,
      };
    });

    // TODO: Send approval notification email to applicant (via Gmail API / SendGrid)

    return {
      success: true,
      message: 'Application approved successfully and club provisioned.',
      clubId: result.clubId,
      leadUid: result.leadUid,
    };
  }
);

export interface RejectApplicationPayload {
  applicationId: string;
  reason: string;
}

/**
 * Board / Admin endpoint to reject club applications.
 * Enforces server-side caller role validation and a MANDATORY non-empty rejection reason.
 * Updates status to 'rejected' and logs immutable audit record in applicationDecisionLog.
 * Does NOT create club or user documents.
 */
export const rejectApplication = onCall<RejectApplicationPayload>(async (request) => {
  // 1. Authorize: requester must be a board member or platform admin
  await verifyBoardOrAdmin(request.auth);

  const { applicationId, reason } = request.data;
  if (!applicationId || typeof applicationId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid applicationId parameter.');
  }

  // Guardrail: Mandatory non-empty rejection reason enforced at server level
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new HttpsError(
      'invalid-argument',
      'A non-empty rejection reason is strictly required for governance accountability.'
    );
  }

  const db = admin.firestore();
  const appRef = db.collection('applications').doc(applicationId);
  const decisionLogRef = db.collection('applicationDecisionLog').doc();

  await db.runTransaction(async (transaction) => {
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
        `Application cannot be rejected; current status is '${appData.status}'.`
      );
    }

    // 2. Update application status
    transaction.update(appRef, {
      status: 'rejected',
      reviewedBy: request.auth!.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      rejectionReason: reason.trim(),
    });

    // 3. Record decision in applicationDecisionLog
    transaction.set(decisionLogRef, {
      applicationId,
      decidedBy: request.auth!.uid,
      decision: 'rejected',
      reason: reason.trim(),
      clubName: appData.clubName,
      university: appData.university,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  // TODO: Send rejection notification email with reason to applicant (via Gmail API / SendGrid)

  return {
    success: true,
    message: `Application ${applicationId} rejected successfully.`,
    applicationId,
    reason: reason.trim(),
  };
});
