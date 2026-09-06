import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { QueryDocumentSnapshot, DocumentData } from '@angular/fire/firestore';
import { ClubService, ClubFilterOptions } from '../../core/services/club.service';
import { AuthService } from '../../core/services/auth.service';
import { Club } from '../../core/models/club.model';

import {
  ALGERIAN_INSTITUTIONS_BY_WILAYA,
  ALL_ALGERIAN_INSTITUTIONS,
  WilayaInstitutions,
} from '../../core/data/algerian-universities.data';

import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-club-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './club-list.component.html',
  styleUrl: './club-list.component.scss',
})
export class ClubListComponent implements OnInit {
  private readonly clubService = inject(ClubService);
  private readonly route = inject(ActivatedRoute);
  readonly authService = inject(AuthService);

  // --- State Signals ---
  readonly clubs = signal<Club[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isLoadingMore = signal<boolean>(false);
  readonly hasMore = signal<boolean>(false);
  readonly totalInitialClubs = signal<number | null>(null);

  // --- Filter State ---
  selectedWilaya = 'all';
  selectedUniversity = 'all';
  selectedCategory = 'all';
  verifiedOnly = true;
  searchTerm = '';

  private lastDocCursor: QueryDocumentSnapshot<DocumentData> | null = null;
  readonly pageSize = 12;

  readonly institutionsByWilaya: WilayaInstitutions[] = ALGERIAN_INSTITUTIONS_BY_WILAYA;
  readonly universities: string[] = ALL_ALGERIAN_INSTITUTIONS;

  get availableInstitutions(): string[] {
    if (this.selectedWilaya === 'all') {
      return this.universities;
    }
    const group = this.institutionsByWilaya.find(
      (g) => g.wilayaCode === this.selectedWilaya || `${g.wilayaCode} - ${g.wilayaName}` === this.selectedWilaya
    );
    return group ? group.institutions : [];
  }

  readonly categories = [
    { key: 'all', label: 'All Categories' },
    { key: 'tech', label: 'Tech & Dev' },
    { key: 'scientific', label: 'Scientific' },
    { key: 'cultural', label: 'Cultural' },
    { key: 'entrepreneurship', label: 'Entrepreneurship' },
    { key: 'general', label: 'General Societies' },
  ];

  ngOnInit(): void {
    const qWilaya = this.route.snapshot.queryParamMap.get('wilaya');
    if (qWilaya) {
      this.selectedWilaya = qWilaya.padStart(2, '0');
    }
    this.loadInitialClubs();
  }

  async loadInitialClubs(): Promise<void> {
    this.isLoading.set(true);
    this.lastDocCursor = null;

    const filter: ClubFilterOptions = {
      wilaya: this.selectedWilaya,
      university: this.selectedUniversity,
      category: this.selectedCategory,
      verifiedOnly: this.verifiedOnly,
      searchTerm: this.searchTerm,
    };

    try {
      const result = await this.clubService.getClubs(filter, this.pageSize, null);
      this.clubs.set(result.clubs);
      this.lastDocCursor = result.lastDoc;
      this.hasMore.set(result.hasMore);

      if (this.totalInitialClubs() === null && this.isFilterDefault()) {
        this.totalInitialClubs.set(result.clubs.length);
      }
    } catch (err) {
      console.error('[ClubList] Error fetching clubs:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (!this.lastDocCursor || this.isLoadingMore()) return;

    this.isLoadingMore.set(true);
    const filter: ClubFilterOptions = {
      wilaya: this.selectedWilaya,
      university: this.selectedUniversity,
      category: this.selectedCategory,
      verifiedOnly: this.verifiedOnly,
      searchTerm: this.searchTerm,
    };

    try {
      const result = await this.clubService.getClubs(filter, this.pageSize, this.lastDocCursor);
      this.clubs.update((prev) => [...prev, ...result.clubs]);
      this.lastDocCursor = result.lastDoc;
      this.hasMore.set(result.hasMore);
    } catch (err) {
      console.error('[ClubList] Error loading more clubs:', err);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  onWilayaChange(): void {
    this.selectedUniversity = 'all';
    this.loadInitialClubs();
  }

  onFilterChange(): void {
    this.loadInitialClubs();
  }

  resetFilters(): void {
    this.selectedWilaya = 'all';
    this.selectedUniversity = 'all';
    this.selectedCategory = 'all';
    this.verifiedOnly = true;
    this.searchTerm = '';
    this.loadInitialClubs();
  }

  isFilterDefault(): boolean {
    return (
      this.selectedWilaya === 'all' &&
      this.selectedUniversity === 'all' &&
      this.selectedCategory === 'all' &&
      this.verifiedOnly === true &&
      !this.searchTerm
    );
  }
}
