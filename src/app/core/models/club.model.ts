export interface ClubLeader {
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
  foundingDate: string; // ISO string YYYY-MM-DD
  category: 'tech' | 'scientific' | 'cultural' | 'entrepreneurship' | 'general';
  description: string;
  logoUrl?: string;
  verified: boolean;
  leadership: ClubLeader[]; // Strictly name & role only; no uid or email stored
  socials: ClubSocials;
  createdAt: string | number | any;
  updatedAt: string | number | any;
}
