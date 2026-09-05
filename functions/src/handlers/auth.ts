import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * Triggered automatically on first-time sign-in (Google Sign-In or Email Sign-Up).
 * Enforces server-side user document creation with a strictly non-elevated baseline role ('visitor').
 * The client NEVER creates users/{uid} documents directly.
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(user.uid);

  const existingDoc = await userRef.get();
  if (existingDoc.exists) {
    // Idempotency guard: do not overwrite if document was pre-provisioned
    return;
  }

  await userRef.set({
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    phoneNumber: user.phoneNumber || null,
    bio: '',
    clubId: null,
    role: 'visitor', // Baseline non-elevated role. Never default to club_lead, board, or admin.
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});
