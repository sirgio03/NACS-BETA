import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyBoardOrAdmin } from '../middleware/auth';

export interface ApproveEventPayload {
  eventId: string;
}

/**
 * Board / Admin endpoint to approve club events.
 * Accepts events in either 'pending' or 'flagged_conflict' status.
 * Updates event status to 'approved' and writes an immutable audit record to moderationDecisionLog.
 */
export const approveEvent = onCall<ApproveEventPayload>(async (request) => {
  // 1. Authorize: caller must be board or admin
  await verifyBoardOrAdmin(request.auth);

  const { eventId } = request.data || {};
  if (!eventId || typeof eventId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid eventId parameter.');
  }

  const db = admin.firestore();
  const eventRef = db.collection('events').doc(eventId);
  const logRef = db.collection('moderationDecisionLog').doc();

  return await db.runTransaction(async (transaction) => {
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists) {
      throw new HttpsError('not-found', `Event ${eventId} not found.`);
    }

    const eventData = eventSnap.data();
    if (!eventData) {
      throw new HttpsError('internal', 'Unable to retrieve event data.');
    }

    if (eventData.status !== 'pending' && eventData.status !== 'flagged_conflict') {
      throw new HttpsError(
        'failed-precondition',
        `Event cannot be approved; current status is '${eventData.status}'.`
      );
    }

    const previousStatus = eventData.status;

    // Update event record to approved
    transaction.update(eventRef, {
      status: 'approved',
      reviewedBy: request.auth!.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Write immutable audit log
    transaction.set(logRef, {
      targetId: eventId,
      targetType: 'event',
      decision: 'approved',
      decidedBy: request.auth!.uid,
      clubId: eventData.clubId || '',
      title: eventData.title || '',
      previousStatus,
      reason:
        previousStatus === 'flagged_conflict'
          ? 'Board resolved and approved event despite schedule proximity flag.'
          : 'Standard event approval.',
      conflictContext: eventData.conflictContext || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      eventId,
      status: 'approved',
      message: 'Event approved successfully.',
    };
  });
});

export interface RejectEventPayload {
  eventId: string;
  reason: string;
}

/**
 * Board / Admin endpoint to reject club events.
 * Strictly mandates a non-empty rejection justification reason.
 * Updates event status to 'rejected' and writes an immutable audit record to moderationDecisionLog.
 */
export const rejectEvent = onCall<RejectEventPayload>(async (request) => {
  // 1. Authorize: caller must be board or admin
  await verifyBoardOrAdmin(request.auth);

  const { eventId, reason } = request.data || {};
  if (!eventId || typeof eventId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid eventId parameter.');
  }

  // Guardrail: Mandatory non-empty rejection reason
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new HttpsError(
      'invalid-argument',
      'A clear justification reason is strictly mandatory to reject an event.'
    );
  }

  const db = admin.firestore();
  const eventRef = db.collection('events').doc(eventId);
  const logRef = db.collection('moderationDecisionLog').doc();

  return await db.runTransaction(async (transaction) => {
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists) {
      throw new HttpsError('not-found', `Event ${eventId} not found.`);
    }

    const eventData = eventSnap.data();
    if (!eventData) {
      throw new HttpsError('internal', 'Unable to retrieve event data.');
    }

    if (eventData.status !== 'pending' && eventData.status !== 'flagged_conflict') {
      throw new HttpsError(
        'failed-precondition',
        `Event cannot be rejected; current status is '${eventData.status}'.`
      );
    }

    const previousStatus = eventData.status;

    // Update event record to rejected
    transaction.update(eventRef, {
      status: 'rejected',
      rejectionReason: reason.trim(),
      reviewedBy: request.auth!.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Write immutable audit log
    transaction.set(logRef, {
      targetId: eventId,
      targetType: 'event',
      decision: 'rejected',
      decidedBy: request.auth!.uid,
      clubId: eventData.clubId || '',
      title: eventData.title || '',
      previousStatus,
      reason: reason.trim(),
      conflictContext: eventData.conflictContext || null,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      eventId,
      status: 'rejected',
      reason: reason.trim(),
      message: 'Event rejected.',
    };
  });
});

export interface ApproveProjectPayload {
  projectId: string;
}

/**
 * Board / Admin endpoint to approve student showcase projects.
 * Updates project status to 'approved' and writes an immutable audit record to moderationDecisionLog.
 */
export const approveProject = onCall<ApproveProjectPayload>(async (request) => {
  // 1. Authorize: caller must be board or admin
  await verifyBoardOrAdmin(request.auth);

  const { projectId } = request.data || {};
  if (!projectId || typeof projectId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid projectId parameter.');
  }

  const db = admin.firestore();
  const projectRef = db.collection('projects').doc(projectId);
  const logRef = db.collection('moderationDecisionLog').doc();

  return await db.runTransaction(async (transaction) => {
    const projectSnap = await transaction.get(projectRef);
    if (!projectSnap.exists) {
      throw new HttpsError('not-found', `Project ${projectId} not found.`);
    }

    const projectData = projectSnap.data();
    if (!projectData) {
      throw new HttpsError('internal', 'Unable to retrieve project data.');
    }

    if (projectData.status !== 'pending') {
      throw new HttpsError(
        'failed-precondition',
        `Project cannot be approved; current status is '${projectData.status}'.`
      );
    }

    const previousStatus = projectData.status;

    // Update project record to approved
    transaction.update(projectRef, {
      status: 'approved',
      reviewedBy: request.auth!.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Write immutable audit log
    transaction.set(logRef, {
      targetId: projectId,
      targetType: 'project',
      decision: 'approved',
      decidedBy: request.auth!.uid,
      clubId: projectData.clubId || '',
      title: projectData.title || '',
      previousStatus,
      reason: 'Project meets student showcase excellence and policy guidelines.',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      projectId,
      status: 'approved',
      message: 'Project approved for public showcase.',
    };
  });
});

export interface RejectProjectPayload {
  projectId: string;
  reason: string;
}

/**
 * Board / Admin endpoint to reject student showcase projects.
 * Strictly mandates a non-empty rejection justification reason.
 * Updates project status to 'rejected' and writes an immutable audit record to moderationDecisionLog.
 */
export const rejectProject = onCall<RejectProjectPayload>(async (request) => {
  // 1. Authorize: caller must be board or admin
  await verifyBoardOrAdmin(request.auth);

  const { projectId, reason } = request.data || {};
  if (!projectId || typeof projectId !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing or invalid projectId parameter.');
  }

  // Guardrail: Mandatory non-empty rejection reason
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new HttpsError(
      'invalid-argument',
      'A clear justification reason is strictly mandatory to reject a project.'
    );
  }

  const db = admin.firestore();
  const projectRef = db.collection('projects').doc(projectId);
  const logRef = db.collection('moderationDecisionLog').doc();

  return await db.runTransaction(async (transaction) => {
    const projectSnap = await transaction.get(projectRef);
    if (!projectSnap.exists) {
      throw new HttpsError('not-found', `Project ${projectId} not found.`);
    }

    const projectData = projectSnap.data();
    if (!projectData) {
      throw new HttpsError('internal', 'Unable to retrieve project data.');
    }

    if (projectData.status !== 'pending') {
      throw new HttpsError(
        'failed-precondition',
        `Project cannot be rejected; current status is '${projectData.status}'.`
      );
    }

    const previousStatus = projectData.status;

    // Update project record to rejected
    transaction.update(projectRef, {
      status: 'rejected',
      rejectionReason: reason.trim(),
      reviewedBy: request.auth!.uid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Write immutable audit log
    transaction.set(logRef, {
      targetId: projectId,
      targetType: 'project',
      decision: 'rejected',
      decidedBy: request.auth!.uid,
      clubId: projectData.clubId || '',
      title: projectData.title || '',
      previousStatus,
      reason: reason.trim(),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      projectId,
      status: 'rejected',
      reason: reason.trim(),
      message: 'Project rejected.',
    };
  });
});
