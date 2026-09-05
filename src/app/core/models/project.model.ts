export type ProjectStatus = 'pending' | 'approved';

export interface ProjectLinks {
  github?: string;
  demo?: string;
  paper?: string;
  video?: string;
}

export interface StudentProject {
  id?: string;
  clubId: string;
  clubName?: string;
  title: string;
  team: string[]; // member names
  description: string;
  tags: string[];
  imageUrls: string[];
  links: ProjectLinks;
  status: ProjectStatus;
  submittedBy: string; // uid
  submittedAt: string | number | any;
}
