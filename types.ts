export interface Business {
  id: string;
  name: string;
  category: string;
  // Extra business meta used mainly for CSV export
  subCategory?: string | null;
  description?: string | null;
  // Full address plus decomposed parts
  address: string;
  street?: string | null;
  country?: string | null;
  city?: string | null;
  area?: string | null;
  pincode?: string | null;
  // Contacts
  phone: string;
  email?: string | null;
  contactPersonName?: string | null;
  registrationNo?: string | null;
  companyLandline?: string | null;
  yearOfEstablishment?: string | null;
  // Geo
  latitude?: number | null;
  longitude?: number | null;
  image?: string | null;
  // Web presence & SEO
  website: string | null;
  socials: string[];
  seoScore?: number | null;
  seoGrade?: 'good' | 'average' | 'poor' | null;
  verificationNotes?: string;
}

export interface SearchParams {
  location: string;
  category: string;
  limit: number;
}

export enum WorkflowStep {
  IDLE = 'IDLE',
  SEARCHING_MAPS = 'SEARCHING_MAPS',
  ANALYZING_RESULTS = 'ANALYZING_RESULTS',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface ProcessingLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'action';
}