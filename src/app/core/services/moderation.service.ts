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

  /**
   * Retrieve all club events awaiting board review (pending or flagged_conflict).
   * Sorted oldest first (first-come-first-served review).
   */
  async getPendingEvents(): Promise<ClubEvent[]> {
    const eventsRef = collection(this.firestore, 'events');
    const q = query(
      eventsRef,
      where('status', 'in', ['pending', 'flagged_conflict']),
      orderBy('createdAt', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      ...(d.data() as ClubEvent),
      id: d.id,
    }));
  }

  /**
   * Approve an event (handles both pending and flagged_conflict events).
   */
  async approveEvent(eventId: string): Promise<ModerationResponse> {
    const callable = httpsCallable<{ eventId: string }, ModerationResponse>(
      this.functions,
      'approveEvent'
    );
    const result = await callable({ eventId });
    return result.data;
  }

  /**
   * Reject an event with mandatory justification reason.
   */
  async rejectEvent(eventId: string, reason: string): Promise<ModerationResponse> {
    const callable = httpsCallable<{ eventId: string; reason: string }, ModerationResponse>(
      this.functions,
      'rejectEvent'
    );
    const result = await callable({ eventId, reason });
    return result.data;
  }

  /**
   * Retrieve all student projects awaiting board review (pending).
   * Sorted oldest first (first-come-first-served review).
   */
  async getPendingProjects(): Promise<StudentProject[]> {
    const projectsRef = collection(this.firestore, 'projects');
    const q = query(
      projectsRef,
      where('status', '==', 'pending'),
      orderBy('submittedAt', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({
      ...(d.data() as StudentProject),
      id: d.id,
    }));
  }

  /**
   * Approve a student project for public showcase.
   */
  async approveProject(projectId: string): Promise<ModerationResponse> {
    const callable = httpsCallable<{ projectId: string }, ModerationResponse>(
      this.functions,
      'approveProject'
    );
    const result = await callable({ projectId });
    return result.data;
  }

  /**
   * Reject a student project with mandatory justification reason.
   */
  async rejectProject(projectId: string, reason: string): Promise<ModerationResponse> {
    const callable = httpsCallable<{ projectId: string; reason: string }, ModerationResponse>(
      this.functions,
      'rejectProject'
    );
    const result = await callable({ projectId, reason });
    return result.data;
  }
}
