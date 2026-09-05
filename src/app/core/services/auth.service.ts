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
    // Listen to Firebase Auth state transitions and sync with Firestore user document
    this.authSub = authState(this.auth)
      .pipe(
        switchMap((user) => {
          this.currentUser.set(user);
          if (!user) {
            this.userProfile.set(null);
            this.loading.set(false);
            return of(null);
          }
          const userDocRef = doc(this.firestore, `users/${user.uid}`);
          return docData(userDocRef);
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
    await signOut(this.auth);
    this.currentUser.set(null);
    this.userProfile.set(null);
    await this.router.navigate(['/']);
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
