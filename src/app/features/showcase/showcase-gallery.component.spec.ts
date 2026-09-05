import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ShowcaseGalleryComponent } from './showcase-gallery.component';
import { ShowcaseService, ProjectPageResult } from '../../core/services/showcase.service';
import { StudentProject } from '../../core/models/project.model';

describe('ShowcaseGalleryComponent', () => {
  let component: ShowcaseGalleryComponent;
  let fixture: ComponentFixture<ShowcaseGalleryComponent>;
  let mockShowcaseService: jasmine.SpyObj<ShowcaseService>;

  const mockApprovedProjects: StudentProject[] = [
    {
      id: 'proj_alpha',
      clubId: 'club_alpha',
      clubName: 'Alpha Robotics USTHB',
      university: 'USTHB (Bab Ezzouar, Algiers)',
      title: 'Autonomous Solar Rover',
      team: ['Yacine M.', 'Lina B.'],
      description: 'Autonomous exploration rover with solar charging and lidar mapping.',
      tags: ['robotics', 'lidar'],
      imageUrls: ['https://example.com/rover.jpg'],
      links: { github: 'https://github.com/alpharobotics/solar-rover' },
      status: 'approved',
      submittedBy: 'lead_user_alpha',
      submittedAt: new Date(),
    },
    {
      id: 'proj_beta',
      clubId: 'club_beta',
      clubName: 'Beta Biotech USTO',
      university: 'USTO-MB (Oran)',
      title: 'Microbial Fuel Cell Prototype',
      team: ['Amel K.', 'Sofiane R.'],
      description: 'Bioelectricity generator using university wastewater microbes.',
      tags: ['biotech', 'cleantech'],
      imageUrls: [],
      links: { demo: 'https://biotech-usto.dz/demo' },
      status: 'approved',
      submittedBy: 'lead_user_beta',
      submittedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    mockShowcaseService = jasmine.createSpyObj('ShowcaseService', [
      'getApprovedProjects',
      'getProjectById',
    ]);

    mockShowcaseService.getApprovedProjects.and.resolveTo({
      projects: mockApprovedProjects,
      lastDoc: null,
      hasMore: false,
    } as ProjectPageResult);

    await TestBed.configureTestingModule({
      imports: [ShowcaseGalleryComponent],
      providers: [
        provideRouter([]),
        { provide: ShowcaseService, useValue: mockShowcaseService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ShowcaseGalleryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load initial approved projects on init', async () => {
    await fixture.whenStable();
    expect(mockShowcaseService.getApprovedProjects).toHaveBeenCalled();
    expect(component.projects().length).toBe(2);
    expect(component.isLoading()).toBeFalse();
  });

  it('should filter projects when selecting a tag', async () => {
    component.selectTag('robotics');
    expect(component.selectedTag).toBe('robotics');
    expect(mockShowcaseService.getApprovedProjects).toHaveBeenCalledTimes(2);
  });

  it('should open and close project inspection modal', () => {
    expect(component.selectedProject()).toBeNull();
    component.openProjectModal(mockApprovedProjects[0]);
    expect(component.selectedProject()).toEqual(mockApprovedProjects[0]);

    component.closeProjectModal();
    expect(component.selectedProject()).toBeNull();
  });

  it('should reset filters', () => {
    component.selectedTag = 'ai';
    component.selectedUniversity = 'USTHB (Bab Ezzouar, Algiers)';
    component.searchTerm = 'rover';

    component.resetFilters();

    expect(component.selectedTag).toBe('all');
    expect(component.selectedUniversity).toBe('all');
    expect(component.searchTerm).toBe('');
  });
});
