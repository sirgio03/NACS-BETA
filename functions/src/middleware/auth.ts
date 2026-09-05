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
