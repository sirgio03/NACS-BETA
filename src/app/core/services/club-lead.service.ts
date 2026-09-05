import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Club, ClubLeader } from '../models/club.model';
import { ClubEvent, EventType, EventStatus } from '../models/event.model';
import { StudentProject } from '../models/project.model';

export interface UpdateClubProfileRequest {
  clubId: string;
  description?: string;
  logoUrl?: string;
  socials?: Record<string, string>;
  leadership?: ClubLeader[];
}

export interface SubmitEventRequest {
  clubId: string;
  title: string;
  date: string;
  endDate: string;
  location: string;
  type: EventType;
  description: string;
}

export interface SubmitEventResponse {
  success: boolean;
  eventId: string;
  status: EventStatus;
  conflictContext?: string | null;
  message: string;
}

export interface SubmitProjectRequest {
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

export interface SubmitProjectResponse {
  success: boolean;
  projectId: string;
  status: string;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ClubLeadService {
  private readonly firestore = inject(Firestore);
  private readonly functions = inject(Functions);

  /**
   * Fetch club document managed by this lead.
   */
  async getMyClub(clubId: string): Promise<Club | null> {
    const docRef = doc(this.firestore, 'clubs', clubId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return {
      ...(snap.data() as Club),
      id: snap.id,
    };
  }

  /**
   * Update editable club profile fields via Cloud Function (enforcing allowlist & server-side ownership).
   */
  async updateClubProfile(payload: UpdateClubProfileRequest): Promise<{ success: boolean; message: string }> {
    const callable = httpsCallable<UpdateClubProfileRequest, { success: boolean; message: string }>(
      this.functions,
      'updateClubProfile'
    );
    const result = await callable(payload);
    return result.data;
  }

  /**
   * Retrieve all events submitted by this club (including pending, flagged_conflict, and approved).
   */
  async getMyEvents(clubId: string): Promise<ClubEvent[]> {
    const eventsRef = collection(this.firestore, 'events');
    const q = query(eventsRef, where('clubId', '==', clubId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...(d.data() as ClubEvent),
      id: d.id,
    }));
  }

  /**
   * Submit new event via Cloud Function (triggers automated conflict detection against approved events).
   */
  async submitEvent(payload: SubmitEventRequest): Promise<SubmitEventResponse> {
    const callable = httpsCallable<SubmitEventRequest, SubmitEventResponse>(
      this.functions,
      'submitEvent'
    );
    const result = await callable(payload);
    return result.data;
  }

  /**
   * Retrieve all showcase projects submitted by this club.
   */
  async getMyProjects(clubId: string): Promise<StudentProject[]> {
    const projectsRef = collection(this.firestore, 'projects');
    const q = query(projectsRef, where('clubId', '==', clubId), orderBy('submittedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...(d.data() as StudentProject),
      id: d.id,
    }));
  }

  /**
   * Submit new student showcase project via Cloud Function.
   */
  async submitProject(payload: SubmitProjectRequest): Promise<SubmitProjectResponse> {
    const callable = httpsCallable<SubmitProjectRequest, SubmitProjectResponse>(
      this.functions,
      'submitProject'
    );
    const result = await callable(payload);
    return result.data;
  }
}
