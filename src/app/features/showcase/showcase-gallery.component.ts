import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { QueryDocumentSnapshot, DocumentData } from '@angular/fire/firestore';
import { ShowcaseService, ProjectFilterOptions } from '../../core/services/showcase.service';
import { StudentProject } from '../../core/models/project.model';

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

  ngOnInit(): void {
    this.loadInitialProjects();
  }

  async loadInitialProjects(): Promise<void> {
    this.isLoading.set(true);
    this.lastDocCursor = null;

    const filter: ProjectFilterOptions = {
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
      console.error('[ShowcaseGallery] Error fetching approved projects:', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (!this.lastDocCursor || this.isLoadingMore()) return;

    this.isLoadingMore.set(true);
    const filter: ProjectFilterOptions = {
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

  onFilterChange(): void {
    this.loadInitialProjects();
  }

  selectTag(tagKey: string): void {
    this.selectedTag = tagKey;
    this.onFilterChange();
  }

  resetFilters(): void {
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
