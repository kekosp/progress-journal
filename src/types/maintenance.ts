export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';
export type MaintenanceStatus = 'planned' | 'in-progress' | 'completed' | 'postponed';

export interface MaintenanceEvent {
  id: string;
  title: string;
  description: string;
  date: string; // ISO date string
  time: string; // HH:mm
  duration: number; // minutes
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  equipment: string;
  assignedTo: string;
  recurring?: RecurringSchedule;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringSchedule {
  type: 'daily' | 'weekly' | 'monthly';
  interval: number; // every N days/weeks/months
  endDate?: string;
}

export const MAINTENANCE_PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  planned: 'Planned',
  'in-progress': 'In Progress',
  completed: 'Completed',
  postponed: 'Postponed',
};

export const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  low: 'bg-info/15 text-info border-info/30',
  medium: 'bg-warning/15 text-warning border-warning/30',
  high: 'bg-accent/15 text-accent border-accent/30',
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
};

export const STATUS_COLORS: Record<MaintenanceStatus, string> = {
  planned: 'bg-info/15 text-info',
  'in-progress': 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
  postponed: 'bg-muted text-muted-foreground',
};
