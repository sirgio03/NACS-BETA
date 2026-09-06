import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AlgeriaMapComponent } from './algeria-map.component';
import { WilayaMapService } from '../../../../core/services/wilaya-map.service';
import { NationalReachSummary } from '../../../../core/models/wilaya-stats.model';

describe('AlgeriaMapComponent', () => {
  let component: AlgeriaMapComponent;
  let fixture: ComponentFixture<AlgeriaMapComponent>;
  let routerSpy: jasmine.SpyObj<Router>;
  let mapServiceSpy: jasmine.SpyObj<WilayaMapService>;

  const mockReachSummary: NationalReachSummary = {
    stats: {
      '16': {
        code: '16',
        name: 'Alger',
        clubCount: 2,
        eventCount: 1,
        hasUpcomingWithin7Days: true,
      },
      '31': {
        code: '31',
        name: 'Oran',
        clubCount: 1,
        eventCount: 1,
        hasUpcomingWithin7Days: false,
      },
      '47': {
        code: '47',
        name: 'Ghardaïa',
        clubCount: 0,
        eventCount: 0,
        hasUpcomingWithin7Days: false,
      },
    },
    totalVerifiedClubs: 3,
    totalUpcomingEvents: 2,
    activeWilayasCount: 2,
    nationalWilayasTotal: 58,
  };

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    mapServiceSpy = jasmine.createSpyObj('WilayaMapService', ['getNationalReach', 'getDemoAggregation']);
    mapServiceSpy.getNationalReach.and.resolveTo(mockReachSummary);
    mapServiceSpy.getDemoAggregation.and.returnValue(mockReachSummary);

    await TestBed.configureTestingModule({
      imports: [AlgeriaMapComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: WilayaMapService, useValue: mapServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlgeriaMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should load reach summary on initialization', () => {
    expect(mapServiceSpy.getNationalReach).toHaveBeenCalled();
    expect(component.reachSummary()).toEqual(mockReachSummary);
  });

  it('should correctly identify if a wilaya has clubs or events', () => {
    expect(component.hasClub('16')).toBeTrue();
    expect(component.hasEvent('16')).toBeTrue();
    expect(component.hasUpcomingWithin7Days('16')).toBeTrue();

    expect(component.hasClub('47')).toBeFalse();
    expect(component.hasEvent('47')).toBeFalse();
    expect(component.hasUpcomingWithin7Days('47')).toBeFalse();
  });

  it('should generate accessible aria-labels for screen readers', () => {
    const pathAlger = { code: '16', name: 'Alger', nameAr: '', d: '' };
    const labelAlger = component.getAriaLabel(pathAlger);
    expect(labelAlger).toContain('Alger wilaya');
    expect(labelAlger).toContain('2 verified clubs');
    expect(labelAlger).toContain('1 upcoming event');

    const pathEmpty = { code: '47', name: 'Ghardaïa', nameAr: '', d: '' };
    const labelEmpty = component.getAriaLabel(pathEmpty);
    expect(labelEmpty).toContain('Ghardaïa wilaya');
    expect(labelEmpty).toContain('no clubs yet');
  });

  it('should navigate to clubs directory pre-filtered when a wilaya is selected', () => {
    component.selectWilaya('16');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/clubs'], {
      queryParams: { wilaya: '16' },
    });
  });

  it('should update tooltip signal on mouse hover and hide on leave', () => {
    const pathAlger = { code: '16', name: 'Alger', nameAr: '', d: '' };
    const fakeEvent = { clientX: 150, clientY: 250 } as MouseEvent;

    component.onPathMouseEnter(pathAlger, fakeEvent);
    expect(component.tooltip().visible).toBeTrue();
    expect(component.tooltip().regionName).toBe('Alger');
    expect(component.tooltip().stats?.clubCount).toBe(2);

    component.onPathMouseLeave();
    expect(component.tooltip().visible).toBeFalse();
  });

  it('should filter mobile wilayas list based on search query', () => {
    component.searchQuery.set('oran');
    const filtered = component.mobileWilayas();
    expect(filtered.length).toBe(1);
    expect(filtered[0].code).toBe('31');

    component.clearSearch();
    expect(component.searchQuery()).toBe('');
  });
});
