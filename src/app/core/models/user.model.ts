export type UserRole = 'visitor' | 'club_lead' | 'board' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  phoneNumber?: string | null;
  bio?: string | null;
  clubId?: string | null;
  role: UserRole;
  createdAt?: string | number | any;
  updatedAt?: string | number | any;
}
