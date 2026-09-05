import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export { submitApplication, approveApplication } from './handlers/applications';
export { scheduledFirestoreBackup } from './backup/scheduled-backup';
