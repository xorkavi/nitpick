export interface Config {
  serviceAccountToken: string;
  serviceAccountId: string;
  circleciToken: string;
  projectSlug: string;
  branch: string;
  devrevEndpoint: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export type NitpickMode = 'analysis' | 'fix' | 'revision';

export interface TimelineEntry {
  id: string;
  body: string;
  created_by: { id: string; display_name: string };
  created_date: string;
}
