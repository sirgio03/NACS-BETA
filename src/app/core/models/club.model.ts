export interface ClubLeader {
  uid: string;
  name: string;
  role: string;
}

export interface ClubSocials {
  website?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  github?: string;
  twitter?: string;
}

export interface Club {
  id?: string;
  name: string;
  university: string;
  foundingDate: string; // ISO string YYYY-MM-DD or timestamp
  category: 'tech' | 'scientific' | 'cultural' | 'entrepreneurship' | 'general';
  description: string;
  logoUrl?: string;
  verified: boolean;
  leadership: ClubLeader[];
  socials: ClubSocials;
  createdAt: string | number | any;
  updatedAt: string | number | any;
}
