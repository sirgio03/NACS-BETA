import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { QueryDocumentSnapshot, DocumentData } from '@angular/fire/firestore';
import { ShowcaseService, ProjectFilterOptions } from '../../core/services/showcase.service';
import { StudentProject } from '../../core/models/project.model';
import {
  ALGERIAN_INSTITUTIONS_BY_WILAYA,
  ALL_ALGERIAN_INSTITUTIONS,
  WilayaInstitutions,
} from '../../core/data/algerian-universities.data';

@Component({
  selector: 'app-showcase-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './showcase-gallery.component.html',
  styleUrl: './showcase-gallery.component.scss',
})
export class ShowcaseGalleryComponent implements OnInit {
  private readonly showcaseService = inject(ShowcaseService);

  // --- State Signals ---
  readonly projects = signal<StudentProject[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly isLoadingMore = signal<boolean>(false);
  readonly hasMore = signal<boolean>(false);
  readonly selectedProject = signal<StudentProject | null>(null);

  // --- Filter State ---
  selectedWilaya = 'all';
  selectedTag = 'all';
  selectedUniversity = 'all';
  searchTerm = '';

  private lastDocCursor: QueryDocumentSnapshot<DocumentData> | null = null;
  readonly pageSize = 12;

  readonly tags = [
    { key: 'all', label: 'All Projects' },
    { key: 'robotics', label: 'Robotics' },
    { key: 'ai', label: 'AI & Data' },
    { key: 'iot', label: 'IoT & Hardware' },
    { key: 'web', label: 'Web Apps' },
    { key: 'mobile', label: 'Mobile' },
    { key: 'biotech', label: 'Biotech' },
    { key: 'cleantech', label: 'Green Tech' },
    { key: 'cybersecurity', label: 'Cybersecurity' },
  ];

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

  ngOnInit(): void {
    this.loadInitialProjects();
  }

  async loadInitialProjects(): Promise<void> {
    this.isLoading.set(true);
    this.lastDocCursor = null;

    const filter: ProjectFilterOptions = {
      wilaya: this.selectedWilaya,
      tag: this.selectedTag,
      university: this.selectedUniversity,
      searchTerm: this.searchTerm,
    };

    try {
      const result = await this.showcaseService.getApprovedProjects(filter, this.pageSize, null);
      this.projects.set(result.projects);
      this.lastDocCursor = result.lastDoc;
      this.hasMore.set(result.hasMore);
    } catch (err) {
      console.error('[ShowcaseGallery] Error fetching projects:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (!this.lastDocCursor || this.isLoadingMore()) return;

    this.isLoadingMore.set(true);
    const filter: ProjectFilterOptions = {
      wilaya: this.selectedWilaya,
      tag: this.selectedTag,
      university: this.selectedUniversity,
      searchTerm: this.searchTerm,
    };

    try {
      const result = await this.showcaseService.getApprovedProjects(filter, this.pageSize, this.lastDocCursor);
      this.projects.update((current) => [...current, ...result.projects]);
      this.lastDocCursor = result.lastDoc;
      this.hasMore.set(result.hasMore);
    } catch (err) {
      console.error('[ShowcaseGallery] Error loading more projects:', err);
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  onWilayaChange(): void {
    this.selectedUniversity = 'all';
    this.loadInitialProjects();
  }

  onFilterChange(): void {
    this.loadInitialProjects();
  }

  selectTag(tagKey: string): void {
    this.selectedTag = tagKey;
    this.onFilterChange();
  }

  resetFilters(): void {
    this.selectedWilaya = 'all';
    this.selectedTag = 'all';
    this.selectedUniversity = 'all';
    this.searchTerm = '';
    this.loadInitialProjects();
  }

  openProjectModal(project: StudentProject): void {
    this.selectedProject.set(project);
  }

  closeProjectModal(): void {
    this.selectedProject.set(null);
  }
}
