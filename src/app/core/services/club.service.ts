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
import { DEMO_CLUBS } from '../data/demo-data';
import { findWilayaByInstitution } from '../data/algerian-universities.data';

export interface ClubFilterOptions {
  wilaya?: string;
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
   * Seamlessly falls back to rich demo dataset in development/unseeded environments.
   */
  async getClubs(
    options: ClubFilterOptions = {},
    pageSize: number = 12,
    cursorDoc: QueryDocumentSnapshot<DocumentData> | null = null
  ): Promise<ClubPageResult> {
    try {
      const clubsRef = collection(this.firestore, 'clubs');
      const constraints: QueryConstraint[] = [];

      const verifiedFilter = options.verifiedOnly !== false;
      constraints.push(where('verified', '==', verifiedFilter));

      if (options.university && options.university !== 'all') {
        constraints.push(where('university', '==', options.university));
      }

      if (options.category && options.category !== 'all') {
        constraints.push(where('category', '==', options.category));
      }

      constraints.push(orderBy('name', 'asc'));
      constraints.push(limit(pageSize + 1));

      if (cursorDoc) {
        constraints.push(startAfter(cursorDoc));
      }

      const q = query(clubsRef, ...constraints);
      const snapshot = await getDocs(q);

      const docs = snapshot.docs;
      if (docs.length > 0) {
        const hasMore = docs.length > pageSize;
        const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;
        const lastDoc = resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null;

        let clubs: Club[] = resultDocs.map((d) => {
          const data = d.data() as Club;
          return {
            ...data,
            id: d.id,
            leadership: (data.leadership || []).map((leader: ClubLeader) => ({
              name: leader.name,
              role: leader.role,
              uid: '',
            })),
          };
        });

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
    } catch {
      // Graceful fallback to demo dataset in local/unseeded dev mode
    }

    return this.getDemoClubsPage(options, pageSize);
  }

  /**
   * Fetch single club by ID with leadership privacy sanitization.
   */
  async getClubById(clubId: string): Promise<Club | null> {
    try {
      const clubRef = doc(this.firestore, `clubs/${clubId}`);
      const snapshot = await getDoc(clubRef);

      if (snapshot.exists()) {
        const data = snapshot.data() as Club;
        const sanitizedLeadership: ClubLeader[] = (data.leadership || []).map((l) => ({
          name: l.name,
          role: l.role,
          uid: '',
        }));

        return {
          ...data,
          id: snapshot.id,
          leadership: sanitizedLeadership,
        };
      }
    } catch {
      // Graceful fallback to demo dataset in local/unseeded dev mode
    }

    const demoClub = DEMO_CLUBS.find((c) => c.id === clubId);
    if (demoClub) {
      return {
        ...demoClub,
        leadership: demoClub.leadership.map((l) => ({ ...l, uid: '' })),
      };
    }

    return null;
  }

  private getDemoClubsPage(options: ClubFilterOptions, pageSize: number): ClubPageResult {
    let filtered = [...DEMO_CLUBS];

    if (options.verifiedOnly !== false) {
      filtered = filtered.filter((c) => c.verified);
    }

    if (options.wilaya && options.wilaya !== 'all') {
      const wTarget = options.wilaya.toLowerCase();
      filtered = filtered.filter((c) => {
        const found = findWilayaByInstitution(c.university);
        if (!found) return false;
        return (
          found.wilayaCode === options.wilaya ||
          found.wilayaName.toLowerCase() === wTarget ||
          `${found.wilayaCode} - ${found.wilayaName}`.toLowerCase() === wTarget
        );
      });
    }

    if (options.university && options.university !== 'all') {
      const u = options.university.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.university.toLowerCase() === u ||
          c.university.toLowerCase().includes(u) ||
          u.includes(c.university.toLowerCase())
      );
    }

    if (options.category && options.category !== 'all') {
      filtered = filtered.filter((c) => c.category === options.category);
    }

    if (options.searchTerm && options.searchTerm.trim().length > 0) {
      const term = options.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.university.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => a.name.localeCompare(b.name));
    const clubs = filtered.slice(0, pageSize);
    const hasMore = filtered.length > pageSize;

    return {
      clubs,
      lastDoc: null,
      hasMore,
    };
  }
}

