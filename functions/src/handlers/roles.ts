import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export interface AssignRolePayload {
  targetUid: string;
  newRole: 'visitor' | 'club_lead' | 'board' | 'admin';
  clubId?: string | null;
}

/**
 * Administrative callable endpoint for role elevation and reassignment.
 * Strictly verifies caller role server-side from Firestore inside the transaction
 * and records every role mutation to the roleChangeLog audit collection.
 */
export const assignUserRole = onCall<AssignRolePayload>(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { targetUid, newRole, clubId } = request.data;

  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid targetUid parameter.');
  }

  const validRoles = ['visitor', 'club_lead', 'board', 'admin'];
  if (!validRoles.includes(newRole)) {
    throw new HttpsError('invalid-argument', `Invalid role '${newRole}'. Allowed roles: ${validRoles.join(', ')}`);
  }

  const db = admin.firestore();
  const callerRef = db.collection('users').doc(request.auth.uid);
  const targetUserRef = db.collection('users').doc(targetUid);
  const auditLogRef = db.collection('roleChangeLog').doc();

  // If assigning club_lead, verify club existence outside transaction
  if (newRole === 'club_lead') {
    if (!clubId) {
      throw new HttpsError('invalid-argument', 'clubId is required when assigning the club_lead role.');
    }
    const clubSnapshot = await db.collection('clubs').doc(clubId).get();
    if (!clubSnapshot.exists) {
      throw new HttpsError('not-found', `Club with ID '${clubId}' does not exist.`);
    }
  }

  const result = await db.runTransaction(async (transaction) => {
    // 1. Verify CALLER's role server-side directly from Firestore inside the transaction
    const callerSnapshot = await transaction.get(callerRef);
    if (!callerSnapshot.exists) {
      throw new HttpsError('permission-denied', 'Caller profile not found.');
    }
    const callerData = callerSnapshot.data();
    if (callerData?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Admin privileges strictly required for role modifications.');
    }

    // 2. Read target user document
    const targetSnapshot = await transaction.get(targetUserRef);
    if (!targetSnapshot.exists) {
      throw new HttpsError('not-found', `Target user document with UID '${targetUid}' does not exist.`);
    }
    const targetData = targetSnapshot.data();
    const previousRole = targetData?.role || 'visitor';

    // 3. Update target user document
    transaction.update(targetUserRef, {
      role: newRole,
      clubId: newRole === 'club_lead' ? clubId : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      assignedBy: request.auth!.uid,
    });

    // 4. Record governance audit log
    transaction.set(auditLogRef, {
      affectedUid: targetUid,
      previousRole,
      newRole,
      changedBy: request.auth!.uid,
      clubId: newRole === 'club_lead' ? clubId : null,
      reason: 'admin_assignment',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      previousRole,
      newRole,
    };
  });

  return {
    success: true,
    message: `Successfully transitioned user '${targetUid}' from '${result.previousRole}' to '${result.newRole}'.`,
    targetUid,
    previousRole: result.previousRole,
    newRole: result.newRole,
    clubId: newRole === 'club_lead' ? clubId : null,
  };
});
