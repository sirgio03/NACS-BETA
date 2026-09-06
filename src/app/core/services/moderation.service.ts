import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { ClubEvent } from '../models/event.model';
import { StudentProject } from '../models/project.model';
import { DEMO_PENDING_EVENTS, DEMO_PENDING_PROJECTS } from '../data/demo-data';

export interface ModerationResponse {
  success: boolean;
  message: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root',
})
export class ModerationService {
  private readonly firestore = inject(Firestore);
  private readonly functions = inject(Functions);
  private demoEvents: ClubEvent[] = [...DEMO_PENDING_EVENTS];
  private demoProjects: StudentProject[] = [...DEMO_PENDING_PROJECTS];

  /**
   * Retrieve all club events awaiting board review (pending or flagged_conflict).
   * Sorted oldest first (first-come-first-served review).
   */
  async getPendingEvents(): Promise<ClubEvent[]> {
    try {
      const eventsRef = collection(this.firestore, 'events');
      const q = query(
        eventsRef,
        where('status', 'in', ['pending', 'flagged_conflict']),
        orderBy('createdAt', 'asc')
      );
      const snapshot = await getDocs(q);
      if (snapshot.docs.length > 0) {
        return snapshot.docs.map((d) => ({
          ...(d.data() as ClubEvent),
          id: d.id,
        }));
      }
    } catch {
      // Graceful fallback in dev / demo mode
    }

    return this.demoEvents.filter((e) => e.status === 'pending' || e.status === 'flagged_conflict');
  }

  /**
   * Approve an event (handles both pending and flagged_conflict events).
   */
  async approveEvent(eventId: string): Promise<ModerationResponse> {
    try {
      const callable = httpsCallable<{ eventId: string }, ModerationResponse>(
        this.functions,
        'approveEvent'
      );
      const result = await callable({ eventId });
      return result.data;
    } catch {
      // Demo fallback
      const target = this.demoEvents.find((e) => e.id === eventId);
      if (target) {
        target.status = 'approved';
        this.demoEvents = this.demoEvents.filter((e) => e.id !== eventId);
      }
      return {
        success: true,
        message: `Event "${target?.title || eventId}" approved successfully. (Demo Mode)`,
      };
    }
  }

  /**
   * Reject an event with mandatory justification reason.
   */
  async rejectEvent(eventId: string, reason: string): Promise<ModerationResponse> {
    try {
      const callable = httpsCallable<{ eventId: string; reason: string }, ModerationResponse>(
        this.functions,
        'rejectEvent'
      );
      const result = await callable({ eventId, reason });
      return result.data;
    } catch {
      // Demo fallback
      const target = this.demoEvents.find((e) => e.id === eventId);
      if (target) {
        target.status = 'rejected';
        target.rejectionReason = reason;
        this.demoEvents = this.demoEvents.filter((e) => e.id !== eventId);
      }
      return {
        success: true,
        message: `Event rejected with justification. (Demo Mode)`,
      };
    }
  }

  /**
   * Retrieve all student projects awaiting board review (pending).
   * Sorted oldest first (first-come-first-served review).
   */
  async getPendingProjects(): Promise<StudentProject[]> {
    try {
      const projectsRef = collection(this.firestore, 'projects');
      const q = query(
        projectsRef,
        where('status', '==', 'pending'),
        orderBy('submittedAt', 'asc')
      );
      const snapshot = await getDocs(q);
      if (snapshot.docs.length > 0) {
        return snapshot.docs.map((d) => ({
          ...(d.data() as StudentProject),
          id: d.id,
        }));
      }
    } catch {
      // Graceful fallback in dev / demo mode
    }

    return this.demoProjects.filter((p) => p.status === 'pending');
  }

  /**
   * Approve a student project for public showcase.
   */
  async approveProject(projectId: string): Promise<ModerationResponse> {
    try {
      const callable = httpsCallable<{ projectId: string }, ModerationResponse>(
        this.functions,
        'approveProject'
      );
      const result = await callable({ projectId });
      return result.data;
    } catch {
      // Demo fallback
      const target = this.demoProjects.find((p) => p.id === projectId);
      if (target) {
        target.status = 'approved';
        this.demoProjects = this.demoProjects.filter((p) => p.id !== projectId);
      }
      return {
        success: true,
        message: `Project "${target?.title || projectId}" approved for showcase. (Demo Mode)`,
      };
    }
  }

  /**
   * Reject a student project with mandatory justification reason.
   */
  async rejectProject(projectId: string, reason: string): Promise<ModerationResponse> {
    try {
      const callable = httpsCallable<{ projectId: string; reason: string }, ModerationResponse>(
        this.functions,
        'rejectProject'
      );
      const result = await callable({ projectId, reason });
      return result.data;
    } catch {
      // Demo fallback
      const target = this.demoProjects.find((p) => p.id === projectId);
      if (target) {
        target.status = 'rejected';
        target.rejectionReason = reason;
        this.demoProjects = this.demoProjects.filter((p) => p.id !== projectId);
      }
      return {
        success: true,
        message: `Project rejected with justification. (Demo Mode)`,
      };
    }
  }
}

