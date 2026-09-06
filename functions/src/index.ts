import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export { submitApplication, approveApplication, rejectApplication } from './handlers/applications';
export { updateClubProfile, submitEvent, submitProject } from './handlers/lead';
export { approveEvent, rejectEvent, approveProject, rejectProject } from './handlers/moderation';
export { onUserCreated } from './handlers/auth';
export { assignUserRole } from './handlers/roles';
export { exportEventIcs, exportEventsIcs } from './handlers/calendar';
export { getWilayaReachStats } from './handlers/map';
export { scheduledFirestoreBackup } from './backup/scheduled-backup';


