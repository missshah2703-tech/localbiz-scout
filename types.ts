export interface Business {
  id: string;
  name: string;
  category: string;
  address: string;
  phone: string;
  website: string | null;
  socials: string[];
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