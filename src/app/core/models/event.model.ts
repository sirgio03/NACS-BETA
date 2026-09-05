export type EventStatus = 'pending' | 'approved' | 'flagged_conflict';

export type EventType = 'hackathon' | 'workshop' | 'conference' | 'seminar' | 'competition' | 'cultural' | 'meetup';

export interface ClubEvent {
  id?: string;
  clubId: string;
  clubName?: string;
  title: string;
  date: string; // ISO 8601 start date-time
  endDate: string; // ISO 8601 end date-time
  location: string;
  type: EventType;
  description: string;
  status: EventStatus;
  conflictContext?: string | null;
  conflictWithEventId?: string | null;
  createdBy: string; // uid
  createdAt: string | number | any;
}
