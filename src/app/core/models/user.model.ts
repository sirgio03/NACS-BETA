export type UserRole = 'club_lead' | 'board' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  clubId?: string | null;
  role: UserRole;
  createdAt?: string | number | any;
  updatedAt?: string | number | any;
}
