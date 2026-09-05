import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export { submitApplication, approveApplication, rejectApplication } from './handlers/applications';
export { onUserCreated } from './handlers/auth';
export { assignUserRole } from './handlers/roles';
export { scheduledFirestoreBackup } from './backup/scheduled-backup';
