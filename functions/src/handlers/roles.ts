import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyAdmin } from '../middleware/auth';

export interface AssignRolePayload {
  targetUid: string;
  newRole: 'visitor' | 'club_lead' | 'board' | 'admin';
  clubId?: string | null;
}

/**
 * Administrative callable endpoint for role elevation and reassignment.
 * Strictly restricted to platform administrators.
 */
export const assignUserRole = onCall<AssignRolePayload>(async (request) => {
  // 1. Enforce admin-only caller privileges
  await verifyAdmin(request.auth);

  const { targetUid, newRole, clubId } = request.data;

  if (!targetUid || typeof targetUid !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid targetUid parameter.');
  }

  const validRoles = ['visitor', 'club_lead', 'board', 'admin'];
  if (!validRoles.includes(newRole)) {
    throw new HttpsError('invalid-argument', `Invalid role '${newRole}'. Allowed roles: ${validRoles.join(', ')}`);
  }

  const db = admin.firestore();
  const targetUserRef = db.collection('users').doc(targetUid);

  const targetSnapshot = await targetUserRef.get();
  if (!targetSnapshot.exists) {
    throw new HttpsError('not-found', `Target user document with UID '${targetUid}' does not exist.`);
  }

  // If assigning club_lead, verify that the clubId exists
  if (newRole === 'club_lead') {
    if (!clubId) {
      throw new HttpsError('invalid-argument', 'clubId is required when assigning the club_lead role.');
    }
    const clubSnapshot = await db.collection('clubs').doc(clubId).get();
    if (!clubSnapshot.exists) {
      throw new HttpsError('not-found', `Club with ID '${clubId}' does not exist.`);
    }
  }

  await targetUserRef.update({
    role: newRole,
    clubId: newRole === 'club_lead' ? clubId : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    assignedBy: request.auth!.uid,
  });

  return {
    success: true,
    message: `Successfully assigned role '${newRole}' to user '${targetUid}'.`,
    targetUid,
    newRole,
    clubId: newRole === 'club_lead' ? clubId : null,
  };
});
