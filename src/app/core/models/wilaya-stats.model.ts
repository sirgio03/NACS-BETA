export interface WilayaStats {
  code: string;
  name: string;
  nameAr?: string;
  clubCount: number;
  eventCount: number;
  hasUpcomingWithin7Days: boolean;
}

export interface NationalReachSummary {
  stats: Record<string, WilayaStats>;
  totalVerifiedClubs: number;
  totalUpcomingEvents: number;
  activeWilayasCount: number;
  nationalWilayasTotal: number;
}
