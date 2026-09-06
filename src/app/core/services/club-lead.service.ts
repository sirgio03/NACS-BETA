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
import { DEMO_CLUBS, DEMO_EVENTS, DEMO_PROJECTS } from '../data/demo-data';

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
  wilaya: string;
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

  private customEvents: ClubEvent[] = [];
  private customProjects: StudentProject[] = [];
  private modifiedClub: Club | null = null;

  /**
   * Fetch club document managed by this lead.
   */
  async getMyClub(clubId: string): Promise<Club | null> {
    try {
      const docRef = doc(this.firestore, 'clubs', clubId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return {
          ...(snap.data() as Club),
          id: snap.id,
        };
      }
    } catch {
      // Graceful fallback in dev / demo mode
    }

    if (this.modifiedClub && this.modifiedClub.id === clubId) {
      return this.modifiedClub;
    }

    const demo = DEMO_CLUBS.find((c) => c.id === clubId) || DEMO_CLUBS[0];
    return { ...demo };
  }

  /**
   * Update editable club profile fields via Cloud Function (enforcing allowlist & server-side ownership).
   */
  async updateClubProfile(payload: UpdateClubProfileRequest): Promise<{ success: boolean; message: string }> {
    try {
      const callable = httpsCallable<UpdateClubProfileRequest, { success: boolean; message: string }>(
        this.functions,
        'updateClubProfile'
      );
      const result = await callable(payload);
      return result.data;
    } catch {
      // Demo fallback
      const base = DEMO_CLUBS.find((c) => c.id === payload.clubId) || DEMO_CLUBS[0];
      this.modifiedClub = {
        ...base,
        id: payload.clubId,
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.logoUrl !== undefined && { logoUrl: payload.logoUrl }),
        ...(payload.socials !== undefined && { socials: payload.socials }),
        ...(payload.leadership !== undefined && { leadership: payload.leadership }),
        updatedAt: new Date().toISOString(),
      };
      return {
        success: true,
        message: 'Club profile successfully updated. (Demo Mode)',
      };
    }
  }

  /**
   * Retrieve all events submitted by this club (including pending, flagged_conflict, and approved).
   */
  async getMyEvents(clubId: string): Promise<ClubEvent[]> {
    try {
      const eventsRef = collection(this.firestore, 'events');
      const q = query(eventsRef, where('clubId', '==', clubId), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      if (snap.docs.length > 0) {
        return snap.docs.map((d) => ({
          ...(d.data() as ClubEvent),
          id: d.id,
        }));
      }
    } catch {
      // Graceful fallback
    }

    const clubDemoEvents = DEMO_EVENTS.filter((e) => e.clubId === clubId);
    return [...this.customEvents.filter((e) => e.clubId === clubId), ...clubDemoEvents];
  }

  /**
   * Submit new event via Cloud Function (triggers automated conflict detection against approved events).
   */
  async submitEvent(payload: SubmitEventRequest): Promise<SubmitEventResponse> {
    try {
      const callable = httpsCallable<SubmitEventRequest, SubmitEventResponse>(
        this.functions,
        'submitEvent'
      );
      const result = await callable(payload);
      return result.data;
    } catch {
      // Demo fallback
      const newEvt: ClubEvent = {
        id: 'demo_evt_' + Date.now(),
        clubId: payload.clubId,
        clubName: this.modifiedClub?.name || DEMO_CLUBS.find((c) => c.id === payload.clubId)?.name || 'My Club',
        title: payload.title,
        date: payload.date,
        endDate: payload.endDate,
        location: payload.location,
        wilaya: payload.wilaya,
        type: payload.type,
        description: payload.description,
        status: 'pending',
        createdBy: 'demo_club_lead_uid',
        createdAt: new Date().toISOString(),
      };
      this.customEvents.unshift(newEvt);
      return {
        success: true,
        eventId: newEvt.id!,
        status: 'pending',
        message: 'Event submitted successfully for board moderation review. (Demo Mode)',
      };
    }
  }

  /**
   * Retrieve all showcase projects submitted by this club.
   */
  async getMyProjects(clubId: string): Promise<StudentProject[]> {
    try {
      const projectsRef = collection(this.firestore, 'projects');
      const q = query(projectsRef, where('clubId', '==', clubId), orderBy('submittedAt', 'desc'));
      const snap = await getDocs(q);
      if (snap.docs.length > 0) {
        return snap.docs.map((d) => ({
          ...(d.data() as StudentProject),
          id: d.id,
        }));
      }
    } catch {
      // Graceful fallback
    }

    const clubDemoProjects = DEMO_PROJECTS.filter((p) => p.clubId === clubId);
    return [...this.customProjects.filter((p) => p.clubId === clubId), ...clubDemoProjects];
  }

  /**
   * Submit new student showcase project via Cloud Function.
   */
  async submitProject(payload: SubmitProjectRequest): Promise<SubmitProjectResponse> {
    try {
      const callable = httpsCallable<SubmitProjectRequest, SubmitProjectResponse>(
        this.functions,
        'submitProject'
      );
      const result = await callable(payload);
      return result.data;
    } catch {
      // Demo fallback
      const newProj: StudentProject = {
        id: 'demo_proj_' + Date.now(),
        clubId: payload.clubId,
        clubName: this.modifiedClub?.name || DEMO_CLUBS.find((c) => c.id === payload.clubId)?.name || 'My Club',
        university: this.modifiedClub?.university || DEMO_CLUBS.find((c) => c.id === payload.clubId)?.university,
        title: payload.title,
        team: payload.team,
        description: payload.description,
        tags: payload.tags,
        imageUrls: payload.imageUrls,
        links: payload.links || {},
        status: 'pending',
        submittedBy: 'demo_club_lead_uid',
        submittedAt: new Date().toISOString(),
      };
      this.customProjects.unshift(newProj);
      return {
        success: true,
        projectId: newProj.id!,
        status: 'pending',
        message: 'Project submitted successfully for showcase moderation. (Demo Mode)',
      };
    }
  }
}

