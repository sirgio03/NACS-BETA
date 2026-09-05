import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyClubLead } from '../middleware/auth';

export interface UpdateClubProfilePayload {
  clubId: string;
  description?: string;
  logoUrl?: string;
  socials?: Record<string, string>;
  leadership?: Array<{ name: string; role: string }>;
  [key: string]: any;
}

const ALLOWED_PROFILE_KEYS = ['clubId', 'description', 'logoUrl', 'socials', 'leadership'];

/**
 * Callable Cloud Function: Update Club Profile
 * Strictly restricted to verified club leads managing their OWN clubId.
 * Enforces an explicit allowlist: description, logoUrl, socials, leadership.
 * Rejects non-allowlisted or protected fields (name, university, category, foundingDate, verified).
 */
export const updateClubProfile = onCall<UpdateClubProfilePayload>(async (request) => {
  const data = request.data;
  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Missing or invalid request payload.');
  }

  // 1. Verify caller is a verified club lead for the specified clubId
  const { clubId } = await verifyClubLead(request.auth, data.clubId);

  // 2. Enforce strict ALLOWLIST on payload keys
  const submittedKeys = Object.keys(data);
  for (const key of submittedKeys) {
    if (!ALLOWED_PROFILE_KEYS.includes(key)) {
      throw new HttpsError(
        'invalid-argument',
        `Field '${key}' is protected or non-allowlisted and cannot be modified by a club lead.`
      );
    }
  }

  // 3. Validate leadership roster (name and role only, NO uid or email)
  if (data.leadership !== undefined) {
    if (!Array.isArray(data.leadership)) {
      throw new HttpsError('invalid-argument', 'Leadership must be an array of members.');
    }

    for (const member of data.leadership) {
      if (!member || typeof member !== 'object') {
        throw new HttpsError('invalid-argument', 'Each leadership entry must be a valid object.');
      }
      if (typeof member.name !== 'string' || !member.name.trim()) {
        throw new HttpsError('invalid-argument', 'Leadership member name is required.');
      }
      if (typeof member.role !== 'string' || !member.role.trim()) {
        throw new HttpsError('invalid-argument', 'Leadership member role is required.');
      }

      // Strict privacy invariant: uid and email are completely forbidden
      const memberKeys = Object.keys(member);
      if (memberKeys.includes('uid') || memberKeys.includes('email')) {
        throw new HttpsError(
          'invalid-argument',
          'Leadership entries cannot contain uid or email. Privacy rules require name and role only.'
        );
      }
    }
  }

  // 4. Construct update payload
  const updates: Record<string, any> = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (data.description !== undefined) {
    updates.description = typeof data.description === 'string' ? data.description.trim() : '';
  }
  if (data.logoUrl !== undefined) {
    updates.logoUrl = typeof data.logoUrl === 'string' ? data.logoUrl.trim() : '';
  }
  if (data.socials !== undefined) {
    updates.socials = typeof data.socials === 'object' && data.socials !== null ? data.socials : {};
  }
  if (data.leadership !== undefined) {
    updates.leadership = data.leadership.map((m) => ({
      name: m.name.trim(),
      role: m.role.trim(),
    }));
  }

  const db = admin.firestore();
  await db.collection('clubs').doc(clubId).update(updates);

  return {
    success: true,
    clubId,
    message: 'Club profile updated successfully.',
  };
});

export interface SubmitEventPayload {
  clubId: string;
  title: string;
  date: string;
  endDate: string;
  location: string;
  type: 'hackathon' | 'workshop' | 'conference' | 'seminar' | 'competition' | 'cultural' | 'meetup';
  description: string;
}

/**
 * Callable Cloud Function: Submit an Event
 * Strictly restricted to verified club leads managing their OWN clubId.
 * Runs an automated date conflict check (+/- 3 days against approved events).
 * Flags conflicting events as 'flagged_conflict' with context instead of silent rejection.
 * Non-conflicting events are set to 'pending'.
 */
export const submitEvent = onCall<SubmitEventPayload>(async (request) => {
  const data = request.data;
  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Missing or invalid request payload.');
  }

  // 1. Verify caller ownership
  const { clubId, uid } = await verifyClubLead(request.auth, data.clubId);

  // 2. Validate event details
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 3) {
    throw new HttpsError('invalid-argument', 'Event title must be at least 3 characters long.');
  }
  if (!data.date || isNaN(new Date(data.date).getTime())) {
    throw new HttpsError('invalid-argument', 'A valid start date is required.');
  }
  if (!data.endDate || isNaN(new Date(data.endDate).getTime())) {
    throw new HttpsError('invalid-argument', 'A valid end date is required.');
  }
  if (new Date(data.endDate).getTime() < new Date(data.date).getTime()) {
    throw new HttpsError('invalid-argument', 'Event end date must be after the start date.');
  }
  if (!data.location || typeof data.location !== 'string' || !data.location.trim()) {
    throw new HttpsError('invalid-argument', 'Event location is required.');
  }
  if (!data.description || typeof data.description !== 'string' || !data.description.trim()) {
    throw new HttpsError('invalid-argument', 'Event description is required.');
  }

  const db = admin.firestore();

  // 3. Retrieve club name for event denormalization
  const clubDoc = await db.collection('clubs').doc(clubId).get();
  const clubName = clubDoc.exists ? clubDoc.data()?.name || 'Campus Society' : 'Campus Society';

  // 4. Automated conflict check (+/- 3 days against approved events)
  const eventDate = new Date(data.date);
  const windowMillis = 3 * 24 * 60 * 60 * 1000;
  const startWindow = new Date(eventDate.getTime() - windowMillis).toISOString();
  const endWindow = new Date(eventDate.getTime() + windowMillis).toISOString();

  const conflictQuerySnapshot = await db
    .collection('events')
    .where('status', '==', 'approved')
    .where('date', '>=', startWindow)
    .where('date', '<=', endWindow)
    .get();

  let status: 'pending' | 'flagged_conflict' = 'pending';
  let conflictContext: string | null = null;
  let conflictWithEventId: string | null = null;

  if (!conflictQuerySnapshot.empty) {
    status = 'flagged_conflict';
    const conflictingDoc = conflictQuerySnapshot.docs[0];
    const conflictingData = conflictingDoc.data();
    conflictWithEventId = conflictingDoc.id;
    const confDateDisplay = conflictingData?.date ? conflictingData.date.split('T')[0] : 'nearby date';
    conflictContext = `Potential schedule clash with approved event "${conflictingData?.title || 'National Event'}" on ${confDateDisplay} (+/- 3 days). Flagged for board review.`;
  }

  // 5. Create event record
  const eventRef = await db.collection('events').add({
    clubId,
    clubName,
    title: data.title.trim(),
    date: data.date,
    endDate: data.endDate,
    location: data.location.trim(),
    type: data.type || 'meetup',
    description: data.description.trim(),
    status,
    conflictContext,
    conflictWithEventId,
    createdBy: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    eventId: eventRef.id,
    status,
    conflictContext,
    message:
      status === 'flagged_conflict'
        ? 'Event submitted but flagged due to nearby approved events. Queued for board moderation.'
        : 'Event submitted successfully and pending board approval.',
  };
});

export interface SubmitProjectPayload {
  clubId: string;
  title: string;
  team: string[];
  description: string;
  tags: string[];
  imageUrls: string[];
  links?: {
    github?: string;
    demo?: string;
    paper?: string;
    video?: string;
  };
}

/**
 * Callable Cloud Function: Submit a Showcase Project
 * Strictly restricted to verified club leads managing their OWN clubId.
 * Creates a project record with 'pending' status awaiting board showcase approval.
 */
export const submitProject = onCall<SubmitProjectPayload>(async (request) => {
  const data = request.data;
  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Missing or invalid request payload.');
  }

  // 1. Verify caller ownership
  const { clubId, uid } = await verifyClubLead(request.auth, data.clubId);

  // 2. Validate project details
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 3) {
    throw new HttpsError('invalid-argument', 'Project title must be at least 3 characters long.');
  }
  if (!data.description || typeof data.description !== 'string' || data.description.trim().length < 10) {
    throw new HttpsError('invalid-argument', 'Project description must be at least 10 characters long.');
  }
  if (!Array.isArray(data.team) || data.team.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one student team member name is required.');
  }
  if (data.imageUrls && Array.isArray(data.imageUrls) && data.imageUrls.length > 5) {
    throw new HttpsError('invalid-argument', 'Maximum 5 project gallery images allowed.');
  }

  const db = admin.firestore();

  // 3. Retrieve club name for project denormalization
  const clubDoc = await db.collection('clubs').doc(clubId).get();
  const clubName = clubDoc.exists ? clubDoc.data()?.name || 'Campus Society' : 'Campus Society';

  // 4. Create project record with 'pending' status
  const projectRef = await db.collection('projects').add({
    clubId,
    clubName,
    title: data.title.trim(),
    team: data.team.map((name) => (typeof name === 'string' ? name.trim() : '')).filter(Boolean),
    description: data.description.trim(),
    tags: Array.isArray(data.tags) ? data.tags.map((t) => t.trim()).filter(Boolean) : [],
    imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : [],
    links: typeof data.links === 'object' && data.links !== null ? data.links : {},
    status: 'pending',
    submittedBy: uid,
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    projectId: projectRef.id,
    status: 'pending',
    message: 'Project submitted successfully and is pending board showcase approval.',
  };
});
