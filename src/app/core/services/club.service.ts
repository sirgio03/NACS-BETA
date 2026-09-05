import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentData,
} from '@angular/fire/firestore';
import { Club, ClubLeader } from '../models/club.model';

export interface ClubFilterOptions {
  university?: string;
  category?: string;
  verifiedOnly?: boolean;
  searchTerm?: string;
}

export interface ClubPageResult {
  clubs: Club[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ClubService {
  private readonly firestore = inject(Firestore);

  /**
   * Fetch paginated list of clubs with server-side filters and cursor pagination.
   * By default, verifiedOnly is strictly true to guarantee only verified clubs appear in public views.
   */
  async getClubs(
    options: ClubFilterOptions = {},
    pageSize: number = 12,
    cursorDoc: QueryDocumentSnapshot<DocumentData> | null = null
  ): Promise<ClubPageResult> {
    const clubsRef = collection(this.firestore, 'clubs');
    const constraints: QueryConstraint[] = [];

    // Guardrail: Public views default to verified-only.
    // Board/Admin can optionally view unverified clubs.
    const verifiedFilter = options.verifiedOnly !== false;
    constraints.push(where('verified', '==', verifiedFilter));

    if (options.university && options.university !== 'all') {
      constraints.push(where('university', '==', options.university));
    }

    if (options.category && options.category !== 'all') {
      constraints.push(where('category', '==', options.category));
    }

    constraints.push(orderBy('name', 'asc'));
    constraints.push(limit(pageSize + 1)); // Fetch 1 extra to determine hasMore cleanly

    if (cursorDoc) {
      constraints.push(startAfter(cursorDoc));
    }

    const q = query(clubsRef, ...constraints);
    const snapshot = await getDocs(q);

    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;
    const lastDoc = resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null;

    let clubs: Club[] = resultDocs.map((d) => {
      const data = d.data() as Club;
      return {
        ...data,
        id: d.id,
        // Privacy safeguard: sanitize leadership to name and role only
        leadership: (data.leadership || []).map((leader: ClubLeader) => ({
          name: leader.name,
          role: leader.role,
          uid: '', // Stripped from public memory model
        })),
      };
    });

    // In-memory search filter if keyword provided
    if (options.searchTerm && options.searchTerm.trim().length > 0) {
      const term = options.searchTerm.toLowerCase().trim();
      clubs = clubs.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.university.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term)
      );
    }

    return {
      clubs,
      lastDoc,
      hasMore,
    };
  }

  /**
   * Fetch single club by ID with leadership privacy sanitization.
   */
  async getClubById(clubId: string): Promise<Club | null> {
    const clubRef = doc(this.firestore, `clubs/${clubId}`);
    const snapshot = await getDoc(clubRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data() as Club;

    // Strict privacy safeguard: Never expose uid or contact email in the public DOM
    const sanitizedLeadership: ClubLeader[] = (data.leadership || []).map((l) => ({
      name: l.name,
      role: l.role,
      uid: '', // Stripped
    }));

    return {
      ...data,
      id: snapshot.id,
      leadership: sanitizedLeadership,
    };
  }
}
