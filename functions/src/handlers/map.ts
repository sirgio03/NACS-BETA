import * as admin from 'firebase-admin';
import { onCall } from 'firebase-functions/v2/https';

export interface WilayaStatsDto {
  code: string;
  clubCount: number;
  eventCount: number;
  hasUpcomingWithin7Days: boolean;
}

export interface WilayaReachResponse {
  stats: Record<string, WilayaStatsDto>;
  totalVerifiedClubs: number;
  totalUpcomingEvents: number;
  activeWilayasCount: number;
  timestamp: string;
}

/**
 * Format string into 2-digit code if numeric, or extract leading digits.
 */
function normalizeWilayaCode(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/^\s*(\d{1,2})/);
  if (match) {
    return match[1].padStart(2, '0');
  }
  return null;
}

/**
 * Server-side callable Cloud Function that aggregates club and event reach across all wilayas.
 * Efficiently computes counts in a single pass without exposing raw documents or triggering client-side multi-queries.
 */
export const getWilayaReachStats = onCall(
  {
    cors: true,
  },
  async (): Promise<WilayaReachResponse> => {
    const db = admin.firestore();
    const now = new Date();
    const todayIso = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in7DaysIso = in7Days.toISOString().split('T')[0];

    const stats: Record<string, WilayaStatsDto> = {};

    const getOrCreate = (code: string): WilayaStatsDto => {
      const formatted = code.padStart(2, '0');
      if (!stats[formatted]) {
        stats[formatted] = {
          code: formatted,
          clubCount: 0,
          eventCount: 0,
          hasUpcomingWithin7Days: false,
        };
      }
      return stats[formatted];
    };

    let totalVerifiedClubs = 0;
    let totalUpcomingEvents = 0;

    try {
      // 1. Query verified clubs
      const clubsSnap = await db.collection('clubs').where('verified', '==', true).get();
      clubsSnap.forEach((doc) => {
        const data = doc.data();
        let code = normalizeWilayaCode(data.wilaya);
        if (!code && data.university) {
          // If wilaya code wasn't directly saved on club, try reading it or infer from name
          const uMatch = String(data.university).match(/\((\d{1,2})\)/);
          if (uMatch) code = uMatch[1].padStart(2, '0');
        }

        if (code) {
          const entry = getOrCreate(code);
          entry.clubCount += 1;
          totalVerifiedClubs += 1;
        }
      });

      // 2. Query approved upcoming events
      const eventsSnap = await db
        .collection('events')
        .where('status', '==', 'approved')
        .where('date', '>=', todayIso)
        .get();

      eventsSnap.forEach((doc) => {
        const data = doc.data();
        const code = normalizeWilayaCode(data.wilaya);
        if (code) {
          const entry = getOrCreate(code);
          entry.eventCount += 1;
          totalUpcomingEvents += 1;

          if (data.date && data.date <= in7DaysIso) {
            entry.hasUpcomingWithin7Days = true;
          }
        }
      });
    } catch (err) {
      console.warn('[getWilayaReachStats] Warning while querying Firestore:', err);
    }

    const activeWilayasCount = Object.values(stats).filter(
      (s) => s.clubCount > 0 || s.eventCount > 0
    ).length;

    return {
      stats,
      totalVerifiedClubs,
      totalUpcomingEvents,
      activeWilayasCount,
      timestamp: now.toISOString(),
    };
  }
);
