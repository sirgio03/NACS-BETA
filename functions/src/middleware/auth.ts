import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

export async function verifyBoardOrAdmin(auth: { uid: string; token: any } | undefined): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const userDoc = await admin.firestore().collection('users').doc(auth.uid).get();
  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'User profile not found.');
  }

  const role = userDoc.data()?.role;
  if (role !== 'board' && role !== 'admin') {
    throw new HttpsError('permission-denied', 'User is not authorized for board/admin operations.');
  }
}

export async function verifyAdmin(auth: { uid: string; token: any } | undefined): Promise<void> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const userDoc = await admin.firestore().collection('users').doc(auth.uid).get();
  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'User profile not found.');
  }

  const role = userDoc.data()?.role;
  if (role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin privileges strictly required for role modifications.');
  }
}

export interface VerifiedClubLead {
  uid: string;
  clubId: string;
  userDoc: admin.firestore.DocumentSnapshot;
}

export async function verifyClubLead(
  auth: { uid: string; token: any } | undefined,
  expectedClubId?: string
): Promise<VerifiedClubLead> {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const userDoc = await admin.firestore().collection('users').doc(auth.uid).get();
  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'User profile not found.');
  }

  const userData = userDoc.data();
  const role = userData?.role;
  if (role !== 'club_lead') {
    throw new HttpsError('permission-denied', 'User is not authorized as a verified club lead.');
  }

  const callerClubId = userData?.clubId;
  if (!callerClubId || typeof callerClubId !== 'string') {
    throw new HttpsError('permission-denied', 'User is not associated with any club.');
  }

  if (expectedClubId && expectedClubId !== callerClubId) {
    throw new HttpsError(
      'permission-denied',
      'Caller does not have permission to manage this club.'
    );
  }

  return {
    uid: auth.uid,
    clubId: callerClubId,
    userDoc,
  };
}

