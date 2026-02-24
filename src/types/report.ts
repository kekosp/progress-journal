export type ReportPriority = 'low' | 'medium' | 'high' | 'critical';
export type ReportStatus = 'draft' | 'in-progress' | 'completed' | 'archived';
export type ReportCategory = 'inspection' | 'maintenance' | 'safety' | 'quality' | 'progress' | 'incident' | 'other';

export interface ReportImage {
  id: string;
  dataUrl: string;
  caption?: string;
  timestamp: string;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  category: ReportCategory;
  priority: ReportPriority;
  status: ReportStatus;
  images: ReportImage[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  projectName?: string;
  location?: string;
}

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  inspection: 'Inspection',
  maintenance: 'Maintenance',
  safety: 'Safety',
  quality: 'Quality Control',
  progress: 'Progress Update',
  incident: 'Incident',
  other: 'Other',
};

export const PRIORITY_LABELS: Record<ReportPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  draft: 'Draft',
  'in-progress': 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};
