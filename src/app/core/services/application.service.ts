import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  QueryConstraint,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { ClubApplication, ApplicationStatus } from '../models/application.model';

export interface ApplicationStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export interface ApproveResponse {
  success: boolean;
  message: string;
  clubId: string;
  leadUid?: string;
}

export interface RejectResponse {
  success: boolean;
  message: string;
  applicationId: string;
  reason: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApplicationService {
  private readonly firestore = inject(Firestore);
  private readonly functions = inject(Functions);

  /**
   * Fetch applications with optional status filter.
   * Pending applications are sorted oldest-first (createdAt ASC) for first-come-first-served governance review.
   */
  async getApplications(statusFilter?: ApplicationStatus | 'all'): Promise<ClubApplication[]> {
    const appsRef = collection(this.firestore, 'applications');
    const constraints: QueryConstraint[] = [];

    if (statusFilter && statusFilter !== 'all') {
      constraints.push(where('status', '==', statusFilter));
      // First-come-first-served: pending applications are sorted oldest-first
      if (statusFilter === 'pending') {
        constraints.push(orderBy('createdAt', 'asc'));
      } else {
        constraints.push(orderBy('createdAt', 'desc'));
      }
    } else {
      constraints.push(orderBy('createdAt', 'desc'));
    }

    const q = query(appsRef, ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map((d) => ({
      ...(d.data() as ClubApplication),
      id: d.id,
    }));
  }

  /**
   * Compute application review counts for the board stats widget.
   */
  async getApplicationStats(): Promise<ApplicationStats> {
    const appsRef = collection(this.firestore, 'applications');
    const snapshot = await getDocs(appsRef);

    let pending = 0;
    let approved = 0;
    let rejected = 0;

    snapshot.docs.forEach((doc) => {
      const data = doc.data() as ClubApplication;
      if (data.status === 'pending') pending++;
      else if (data.status === 'approved') approved++;
      else if (data.status === 'rejected') rejected++;
    });

    return {
      pending,
      approved,
      rejected,
      total: snapshot.size,
    };
  }

  /**
   * Execute atomic application approval via Cloud Function.
   */
  async approveApplication(applicationId: string): Promise<ApproveResponse> {
    const callable = httpsCallable<{ applicationId: string }, ApproveResponse>(
      this.functions,
      'approveApplication'
    );
    const result = await callable({ applicationId });
    return result.data;
  }

  /**
   * Execute application rejection with mandatory justification reason via Cloud Function.
   */
  async rejectApplication(applicationId: string, reason: string): Promise<RejectResponse> {
    const trimmedReason = reason ? reason.trim() : '';
    if (!trimmedReason) {
      throw new Error('A rejection reason is strictly required.');
    }

    const callable = httpsCallable<{ applicationId: string; reason: string }, RejectResponse>(
      this.functions,
      'rejectApplication'
    );
    const result = await callable({ applicationId, reason: trimmedReason });
    return result.data;
  }
}
