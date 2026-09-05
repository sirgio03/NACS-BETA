import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { QueryDocumentSnapshot, DocumentData } from '@angular/fire/firestore';
import { ClubService, ClubFilterOptions } from '../../core/services/club.service';
import { AuthService } from '../../core/services/auth.service';
import { Club } from '../../core/models/club.model';

@Component({
  selector: 'app-club-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './club-list.component.html',
  styleUrl: './club-list.component.scss',
})
export class ClubListComponent implements OnInit {
  private readonly clubService = inject(ClubService);
  readonly authService = inject(AuthService);

  // --- State Signals ---
  readonly clubs = signal<Club[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isLoadingMore = signal<boolean>(false);
  readonly hasMore = signal<boolean>(false);
  readonly totalInitialClubs = signal<number | null>(null);

  // --- Filter State ---
  selectedUniversity = 'all';
  selectedCategory = 'all';
  verifiedOnly = true;
  searchTerm = '';

  private lastDocCursor: QueryDocumentSnapshot<DocumentData> | null = null;
  readonly pageSize = 12;

  readonly universities: string[] = [
    'USTHB (Bab Ezzouar, Algiers)',
    'ESI (Oued Smar, Algiers)',
    'USTO-MB (Oran)',
    'University of Algiers 1 (Benyoucef Benkhedda)',
    'University of Constantine 1 (Frères Mentouri)',
    'University Badji Mokhtar (Annaba)',
    'University Abou Bekr Belkaïd (Tlemcen)',
    'University Ferhat Abbas (Setif 1)',
    'University of Batna 2 (Mostefa Ben Boulaïd)',
    'ENP (El Harrach, Algiers)',
  ];

  readonly categories = [
    { key: 'all', label: 'All Categories' },
    { key: 'tech', label: 'Tech & Dev' },
    { key: 'scientific', label: 'Scientific' },
    { key: 'cultural', label: 'Cultural' },
    { key: 'entrepreneurship', label: 'Entrepreneurship' },
    { key: 'general', label: 'General Societies' },
  ];

  ngOnInit(): void {
    this.loadInitialClubs();
  }

  async loadInitialClubs(): Promise<void> {
    this.isLoading.set(true);
    this.lastDocCursor = null;

    const filter: ClubFilterOptions = {
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

  onFilterChange(): void {
    this.loadInitialClubs();
  }

  resetFilters(): void {
    this.selectedUniversity = 'all';
    this.selectedCategory = 'all';
    this.verifiedOnly = true;
    this.searchTerm = '';
    this.loadInitialClubs();
  }

  isFilterDefault(): boolean {
    return (
      this.selectedUniversity === 'all' &&
      this.selectedCategory === 'all' &&
      this.verifiedOnly === true &&
      !this.searchTerm
    );
  }
}
