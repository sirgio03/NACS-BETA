import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';

/**
 * Scheduled Firestore Export to Cloud Storage
 * Enforces the disaster recovery requirement: Automated daily backup of all Firestore
 * collections before real club data is entered.
 */
export const scheduledFirestoreBackup = onSchedule(
  {
    schedule: 'every day 03:00',
    timeZone: 'Africa/Algiers',
  },
  async (event) => {
    const bucketUri = process.env['FIRESTORE_BACKUP_STORAGE_BUCKET'];
    if (!bucketUri) {
      logger.warn('[Backup] FIRESTORE_BACKUP_STORAGE_BUCKET environment variable is not defined. Skipping export.');
      return;
    }

    logger.info(`[Backup] Initiating scheduled Firestore export to ${bucketUri}...`);
    try {
      // Dynamic import to allow graceful fallback in local emulator environments
      const firestore = await import('@google-cloud/firestore');
      const client = new (firestore as any).v1.FirestoreAdminClient();

      const projectId = process.env['GCLOUD_PROJECT'] || process.env['FIREBASE_CONFIG'] 
        ? JSON.parse(process.env['FIREBASE_CONFIG'] || '{}').projectId 
        : 'nacs-platform-prod';

      const databaseName = client.databasePath(projectId, '(default)');

      const [response] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix: bucketUri,
        collectionIds: ['clubs', 'events', 'projects', 'applications', 'users'],
      });

      logger.info(`[Backup] Export operation initiated successfully: ${response.name}`);
    } catch (err: any) {
      logger.error('[Backup] Firestore export operation failed:', err);
    }
  }
);
