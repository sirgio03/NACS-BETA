import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { WilayaStats, NationalReachSummary } from '../models/wilaya-stats.model';
import { ALGERIAN_INSTITUTIONS_BY_WILAYA, findWilayaByInstitution } from '../data/algerian-universities.data';
import { DEMO_CLUBS, DEMO_EVENTS } from '../data/demo-data';

interface CloudFunctionReachResponse {
  stats: Record<string, { code: string; clubCount: number; eventCount: number; hasUpcomingWithin7Days: boolean }>;
  totalVerifiedClubs: number;
  totalUpcomingEvents: number;
  activeWilayasCount: number;
  timestamp: string;
}

@Injectable({
  providedIn: 'root',
})
export class WilayaMapService {
  private readonly functions = inject(Functions, { optional: true });

  /**
   * Fetch aggregated national reach statistics across all 58 wilayas.
   * Calls server-side Cloud Function for instant pre-aggregated reads,
   * with seamless fallback to demo data for unseeded/local dev mode.
   */
  async getNationalReach(): Promise<NationalReachSummary> {
    if (this.functions) {
      try {
        const callable = httpsCallable<void, CloudFunctionReachResponse>(
          this.functions,
          'getWilayaReachStats'
        );
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Reach stats timeout')), 1500)
        );
        const result = await Promise.race([callable(), timeoutPromise]);
        if (result && result.data && result.data.stats) {
          return this.mergeWithMasterCatalog(result.data.stats);
        }
      } catch {
        // Fallback gracefully to demo dataset
        console.info('[WilayaMapService] Cloud Function unavailable or timed out; using demo aggregate.');
      }
    }

    return this.getDemoAggregation();
  }

  /**
   * Merge raw aggregated counts with the institutional wilaya catalog.
   */
  private mergeWithMasterCatalog(
    rawStats: Record<string, { code: string; clubCount: number; eventCount: number; hasUpcomingWithin7Days: boolean }>
  ): NationalReachSummary {
    const stats: Record<string, WilayaStats> = {};
    let totalClubs = 0;
    let totalEvents = 0;

    for (const w of ALGERIAN_INSTITUTIONS_BY_WILAYA) {
      const code = w.wilayaCode.padStart(2, '0');
      const raw = rawStats[code] || {
        code,
        clubCount: 0,
        eventCount: 0,
        hasUpcomingWithin7Days: false,
      };

      stats[code] = {
        code,
        name: w.wilayaName,
        clubCount: raw.clubCount || 0,
        eventCount: raw.eventCount || 0,
        hasUpcomingWithin7Days: !!raw.hasUpcomingWithin7Days,
      };

      totalClubs += stats[code].clubCount;
      totalEvents += stats[code].eventCount;
    }

    const activeCount = Object.values(stats).filter((s) => s.clubCount > 0 || s.eventCount > 0).length;

    return {
      stats,
      totalVerifiedClubs: totalClubs,
      totalUpcomingEvents: totalEvents,
      activeWilayasCount: activeCount,
      nationalWilayasTotal: 58,
    };
  }

  /**
   * Build live aggregated stats from the demo dataset.
   */
  getDemoAggregation(): NationalReachSummary {
    const stats: Record<string, WilayaStats> = {};
    const now = new Date();
    const todayIso = now.toISOString().split('T')[0];
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    for (const w of ALGERIAN_INSTITUTIONS_BY_WILAYA) {
      const code = w.wilayaCode.padStart(2, '0');
      stats[code] = {
        code,
        name: w.wilayaName,
        clubCount: 0,
        eventCount: 0,
        hasUpcomingWithin7Days: false,
      };
    }

    // 1. Aggregate verified clubs
    const verifiedClubs = DEMO_CLUBS.filter((c) => c.verified);
    for (const club of verifiedClubs) {
      const foundWilaya = findWilayaByInstitution(club.university);
      if (foundWilaya) {
        const code = foundWilaya.wilayaCode.padStart(2, '0');
        if (stats[code]) {
          stats[code].clubCount += 1;
        }
      }
    }

    // 2. Aggregate approved upcoming events
    const approvedEvents = DEMO_EVENTS.filter((e) => e.status === 'approved' && e.date >= todayIso);
    for (const evt of approvedEvents) {
      const match = (evt.wilaya || '').match(/^\s*(\d{1,2})/);
      if (match) {
        const code = match[1].padStart(2, '0');
        if (stats[code]) {
          stats[code].eventCount += 1;
          if (evt.date <= next7Days) {
            stats[code].hasUpcomingWithin7Days = true;
          }
        }
      }
    }

    let totalClubs = 0;
    let totalEvents = 0;
    for (const s of Object.values(stats)) {
      totalClubs += s.clubCount;
      totalEvents += s.eventCount;
    }

    const activeCount = Object.values(stats).filter((s) => s.clubCount > 0 || s.eventCount > 0).length;

    return {
      stats,
      totalVerifiedClubs: totalClubs,
      totalUpcomingEvents: totalEvents,
      activeWilayasCount: activeCount,
      nationalWilayasTotal: 58,
    };
  }
}
