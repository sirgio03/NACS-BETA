import { TestBed } from '@angular/core/testing';
import { WilayaMapService } from './wilaya-map.service';
import { Functions } from '@angular/fire/functions';

describe('WilayaMapService', () => {
  let service: WilayaMapService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WilayaMapService,
        { provide: Functions, useValue: null }, // test demo fallback
      ],
    });
    service = TestBed.inject(WilayaMapService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should aggregate demo data correctly when Cloud Functions is unavailable', async () => {
    const summary = await service.getNationalReach();

    expect(summary).toBeDefined();
    expect(summary.nationalWilayasTotal).toBe(58);
    expect(summary.totalVerifiedClubs).toBeGreaterThan(0);
    expect(summary.totalUpcomingEvents).toBeGreaterThan(0);
    expect(summary.activeWilayasCount).toBeGreaterThan(0);

    // Algiers (16) should have clubs and events from DEMO_CLUBS and DEMO_EVENTS
    const algiers = summary.stats['16'];
    expect(algiers).toBeDefined();
    expect(algiers.code).toBe('16');
    expect(algiers.clubCount).toBeGreaterThan(0);

    // Check empty wilaya has 0 counts
    const emptyWilaya = summary.stats['54']; // In Guezzam
    expect(emptyWilaya).toBeDefined();
    expect(emptyWilaya.clubCount).toBe(0);
  });

  it('should cover all 58 wilayas in the stats mapping', async () => {
    const summary = await service.getNationalReach();
    for (let i = 1; i <= 58; i++) {
      const code = String(i).padStart(2, '0');
      expect(summary.stats[code]).withContext(`Wilaya ${code} should exist in stats`).toBeDefined();
      expect(summary.stats[code].name).toBeTruthy();
    }
  });
});
