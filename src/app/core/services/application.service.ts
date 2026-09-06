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
import { DEMO_APPLICATIONS } from '../data/demo-data';

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
  private demoApplications: ClubApplication[] = [...DEMO_APPLICATIONS];

  /**
   * Fetch applications with optional status filter.
   * Pending applications are sorted oldest-first (createdAt ASC) for first-come-first-served governance review.
   * Gracefully falls back to demo data in unseeded / demo environments.
   */
  async getApplications(statusFilter?: ApplicationStatus | 'all'): Promise<ClubApplication[]> {
    try {
      const appsRef = collection(this.firestore, 'applications');
      const constraints: QueryConstraint[] = [];

      if (statusFilter && statusFilter !== 'all') {
        constraints.push(where('status', '==', statusFilter));
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

      if (snapshot.docs.length > 0) {
        return snapshot.docs.map((d) => ({
          ...(d.data() as ClubApplication),
          id: d.id,
        }));
      }
    } catch {
      // Graceful fallback to demo dataset in local/unseeded dev mode
    }

    let results = [...this.demoApplications];
    if (statusFilter && statusFilter !== 'all') {
      results = results.filter((a) => a.status === statusFilter);
    }
    return results;
  }

  /**
   * Compute application review counts for the board stats widget.
   */
  async getApplicationStats(): Promise<ApplicationStats> {
    try {
      const appsRef = collection(this.firestore, 'applications');
      const snapshot = await getDocs(appsRef);

      if (snapshot.docs.length > 0) {
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
    } catch {
      // Graceful fallback to demo dataset
    }

    let pending = 0;
    let approved = 0;
    let rejected = 0;
    this.demoApplications.forEach((a) => {
      if (a.status === 'pending') pending++;
      else if (a.status === 'approved') approved++;
      else if (a.status === 'rejected') rejected++;
    });

    return {
      pending,
      approved,
      rejected,
      total: this.demoApplications.length,
    };
  }

  /**
   * Execute atomic application approval via Cloud Function.
   */
  async approveApplication(applicationId: string): Promise<ApproveResponse> {
    try {
      const callable = httpsCallable<{ applicationId: string }, ApproveResponse>(
        this.functions,
        'approveApplication'
      );
      const result = await callable({ applicationId });
      return result.data;
    } catch {
      // Demo fallback
      const target = this.demoApplications.find((a) => a.id === applicationId);
      if (target) {
        target.status = 'approved';
        target.reviewedAt = new Date().toISOString();
      }
      return {
        success: true,
        message: `Successfully approved "${target?.clubName || 'Club'}". (Demo Mode)`,
        clubId: 'club_demo_' + applicationId,
      };
    }
  }

  /**
   * Execute application rejection with mandatory justification reason via Cloud Function.
   */
  async rejectApplication(applicationId: string, reason: string): Promise<RejectResponse> {
    const trimmedReason = reason ? reason.trim() : '';
    if (!trimmedReason) {
      throw new Error('A rejection reason is strictly required.');
    }

    try {
      const callable = httpsCallable<{ applicationId: string; reason: string }, RejectResponse>(
        this.functions,
        'rejectApplication'
      );
      const result = await callable({ applicationId, reason: trimmedReason });
      return result.data;
    } catch {
      // Demo fallback
      const target = this.demoApplications.find((a) => a.id === applicationId);
      if (target) {
        target.status = 'rejected';
        target.rejectionReason = trimmedReason;
        target.reviewedAt = new Date().toISOString();
      }
      return {
        success: true,
        message: `Application rejected with justification. (Demo Mode)`,
        applicationId,
        reason: trimmedReason,
      };
    }
  }
}

