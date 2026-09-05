export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface ApplicationSubmissionData {
  category: 'tech' | 'scientific' | 'cultural' | 'entrepreneurship' | 'general';
  description: string;
  foundingDate: string;
  leadName: string;
  leadUid?: string;
  leadPhone?: string;
  officialUniversityAffiliationDoc?: string;
  socials?: Record<string, string>;
  motivation?: string;
}

export interface ClubApplication {
  id?: string;
  clubName: string;
  university: string;
  contactEmail: string;
  status: ApplicationStatus;
  submittedData: ApplicationSubmissionData;
  reviewedBy?: string; // uid of board/admin
  reviewedAt?: string | number | any;
  createdAt?: string | number | any;
}
