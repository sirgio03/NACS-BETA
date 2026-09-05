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
import { StudentProject } from '../models/project.model';

export interface ProjectFilterOptions {
  tag?: string;
  university?: string;
  clubId?: string;
  searchTerm?: string;
}

export interface ProjectPageResult {
  projects: StudentProject[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ShowcaseService {
  private readonly firestore = inject(Firestore);

  /**
   * Fetch approved student projects for public showcase gallery.
   * Strictly filters where('status', '==', 'approved') to comply with security rules.
   */
  async getApprovedProjects(
    options: ProjectFilterOptions = {},
    pageSize: number = 12,
    cursorDoc: QueryDocumentSnapshot<DocumentData> | null = null
  ): Promise<ProjectPageResult> {
    const projectsRef = collection(this.firestore, 'projects');
    const constraints: QueryConstraint[] = [];

    // Invariant: Public showcase only ever reads approved projects
    constraints.push(where('status', '==', 'approved'));

    if (options.tag && options.tag !== 'all') {
      constraints.push(where('tags', 'array-contains', options.tag));
    }

    if (options.university && options.university !== 'all') {
      constraints.push(where('university', '==', options.university));
    }

    if (options.clubId && options.clubId !== 'all') {
      constraints.push(where('clubId', '==', options.clubId));
    }

    constraints.push(orderBy('submittedAt', 'desc'));
    constraints.push(limit(pageSize + 1));

    if (cursorDoc) {
      constraints.push(startAfter(cursorDoc));
    }

    const q = query(projectsRef, ...constraints);
    const snapshot = await getDocs(q);

    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const resultDocs = hasMore ? docs.slice(0, pageSize) : docs;
    const lastDoc = resultDocs.length > 0 ? resultDocs[resultDocs.length - 1] : null;

    let projects: StudentProject[] = resultDocs.map((d) => {
      const data = d.data() as StudentProject;
      return {
        ...data,
        id: d.id,
      };
    });

    // In-memory search filter if keyword provided
    if (options.searchTerm && options.searchTerm.trim().length > 0) {
      const term = options.searchTerm.toLowerCase().trim();
      projects = projects.filter(
        (p) =>
          p.title.toLowerCase().includes(term) ||
          p.description.toLowerCase().includes(term) ||
          (p.clubName && p.clubName.toLowerCase().includes(term)) ||
          (p.team && p.team.some((member) => member.toLowerCase().includes(term)))
      );
    }

    return {
      projects,
      lastDoc,
      hasMore,
    };
  }

  /**
   * Fetch a single project by ID.
   */
  async getProjectById(projectId: string): Promise<StudentProject | null> {
    const docRef = doc(this.firestore, 'projects', projectId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return null;
    }
    return {
      ...(snap.data() as StudentProject),
      id: snap.id,
    };
  }
}
