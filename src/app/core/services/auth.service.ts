import { Injectable, inject, signal, computed, DestroyRef } from '@angular/core';
import {
  Auth,
  User,
  authState,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile as updateAuthProfile,
  signOut,
  UserCredential,
} from '@angular/fire/auth';
import {
  Firestore,
  doc,
  docData,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Router } from '@angular/router';
import { Subscription, of, switchMap } from 'rxjs';
import { UserProfile, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // --- State Signals ---
  readonly currentUser = signal<User | null>(null);
  readonly userProfile = signal<UserProfile | null>(null);
  readonly loading = signal<boolean>(true);

  // --- Computed Role Signals ---
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly userRole = computed<UserRole>(() => this.userProfile()?.role ?? 'visitor');
  readonly isClubLead = computed(() => this.userRole() === 'club_lead');
  readonly isBoard = computed(() => this.userRole() === 'board');
  readonly isAdmin = computed(() => this.userRole() === 'admin');
  readonly isBoardOrAdmin = computed(() => this.isBoard() || this.isAdmin());

  private authSub: Subscription;

  constructor() {
    // Check for saved demo session in local storage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('nacs-demo-auth');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.user && parsed?.profile) {
            this.currentUser.set(parsed.user as User);
            this.userProfile.set(parsed.profile as UserProfile);
            this.loading.set(false);
          }
        }
      } catch {
        // Ignore local storage parse error
      }
    }

    // Listen to Firebase Auth state transitions and sync with Firestore user document
    this.authSub = authState(this.auth)
      .pipe(
        switchMap((user) => {
          if (user) {
            this.currentUser.set(user);
            const userDocRef = doc(this.firestore, `users/${user.uid}`);
            return docData(userDocRef);
          }
          // If no Firebase user but demo session exists, preserve demo session
          if (!this.currentUser()) {
            this.userProfile.set(null);
            this.loading.set(false);
          }
          return of(null);
        })
      )
      .subscribe({
        next: (profileData) => {
          if (profileData) {
            this.userProfile.set(profileData as UserProfile);
          }
          this.loading.set(false);
        },
        error: (err) => {
          console.error('[AuthService] Profile subscription error:', err);
          this.loading.set(false);
        },
      });

    this.destroyRef.onDestroy(() => {
      this.authSub?.unsubscribe();
    });
  }

  /**
   * Primary authentication method: Google Sign-In with popup.
   */
  async signInWithGoogle(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      this.loading.set(true);
      const credential = await signInWithPopup(this.auth, provider);
      return credential;
    } catch (error) {
      this.loading.set(false);
      throw error;
    }
  }

  /**
   * Secondary fallback authentication: Email & Password sign-in.
   */
  async signInWithEmail(email: string, password: string): Promise<UserCredential> {
    try {
      this.loading.set(true);
      const credential = await signInWithEmailAndPassword(this.auth, email, password);
      return credential;
    } catch (error) {
      this.loading.set(false);
      throw error;
    }
  }

  /**
   * Secondary fallback authentication: Email & Password registration.
   */
  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<UserCredential> {
    try {
      this.loading.set(true);
      const credential = await createUserWithEmailAndPassword(this.auth, email, password);
      if (displayName && credential.user) {
        await updateAuthProfile(credential.user, { displayName });
      }
      return credential;
    } catch (error) {
      this.loading.set(false);
      throw error;
    }
  }

  /**
   * Terminate active user session.
   */
  async signOut(): Promise<void> {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('nacs-demo-auth');
      } catch {
        // Ignore local storage error
      }
    }
    try {
      await signOut(this.auth);
    } catch {
      // Ignore if offline / mock auth
    }
    this.currentUser.set(null);
    this.userProfile.set(null);
    await this.router.navigate(['/']);
  }

  /**
   * Quick 1-click Demo Account Sign-In for evaluating the platform and dashboards.
   */
  loginAsDemo(role: 'admin' | 'board' | 'club_lead' | 'visitor', customClubId?: string): void {
    const accounts: Record<string, { user: any; profile: UserProfile }> = {
      admin: {
        user: {
          uid: 'demo_board_admin_uid',
          email: 'admin@nacs.dz',
          displayName: 'Dr. Karim Benali (Board Admin)',
        },
        profile: {
          uid: 'demo_board_admin_uid',
          email: 'admin@nacs.dz',
          displayName: 'Dr. Karim Benali (Board Admin)',
          role: 'admin',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      },
      board: {
        user: {
          uid: 'demo_board_officer_uid',
          email: 'board@nacs.dz',
          displayName: 'Amira Cherif (Board Officer)',
        },
        profile: {
          uid: 'demo_board_officer_uid',
          email: 'board@nacs.dz',
          displayName: 'Amira Cherif (Board Officer)',
          role: 'board',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      },
      club_lead: {
        user: {
          uid: 'demo_club_lead_uid',
          email: 'lead@alpharobotics.dz',
          displayName: 'Amina Mansouri (Alpha Robotics Lead)',
        },
        profile: {
          uid: 'demo_club_lead_uid',
          email: 'lead@alpharobotics.dz',
          displayName: 'Amina Mansouri (Alpha Robotics Lead)',
          role: 'club_lead',
          clubId: customClubId || 'club_alpha',
          createdAt: '2026-01-10T10:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      },
      visitor: {
        user: {
          uid: 'demo_student_uid',
          email: 'student@usthb.dz',
          displayName: 'Yanis Ziane (Student Visitor)',
        },
        profile: {
          uid: 'demo_student_uid',
          email: 'student@usthb.dz',
          displayName: 'Yanis Ziane (Student Visitor)',
          role: 'visitor',
          createdAt: '2026-03-01T10:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
        },
      },
    };

    const account = accounts[role] || accounts['visitor'];
    this.currentUser.set(account.user as User);
    this.userProfile.set(account.profile);
    this.loading.set(false);

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('nacs-demo-auth', JSON.stringify(account));
      } catch {
        // Ignore local storage error
      }
    }
  }

  /**
   * Client-side profile update strictly restricted to the allowlist defined in security rules:
   * ['displayName', 'photoURL', 'phoneNumber', 'bio', 'updatedAt'].
   * Under no circumstance can a user mutate 'role' or 'clubId'.
   */
  async updateProfile(data: {
    displayName?: string;
    photoURL?: string;
    phoneNumber?: string;
    bio?: string;
  }): Promise<void> {
    const user = this.currentUser();
    if (!user) {
      throw new Error('User must be authenticated to update profile.');
    }

    const allowedUpdates: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };

    if (data.displayName !== undefined) allowedUpdates['displayName'] = data.displayName;
    if (data.photoURL !== undefined) allowedUpdates['photoURL'] = data.photoURL;
    if (data.phoneNumber !== undefined) allowedUpdates['phoneNumber'] = data.phoneNumber;
    if (data.bio !== undefined) allowedUpdates['bio'] = data.bio;

    const userDocRef = doc(this.firestore, `users/${user.uid}`);
    await updateDoc(userDocRef, allowedUpdates);

    if (data.displayName !== undefined || data.photoURL !== undefined) {
      await updateAuthProfile(user, {
        displayName: data.displayName,
        photoURL: data.photoURL,
      });
    }
  }
}
