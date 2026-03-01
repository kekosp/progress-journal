// ─── Maintenance Schedule Storage ────────────────────────────────────────────

const SCHEDULE_KEY = 'maintenance-schedule';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';
export type MaintenanceCategory = 'inspection' | 'maintenance' | 'safety' | 'quality' | 'progress' | 'incident' | 'other';

export interface MaintenanceEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO date string YYYY-MM-DD
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  completed: boolean;
  completedAt?: string;
}

export function getEvents(): MaintenanceEvent[] {
  try {
    const data = localStorage.getItem(SCHEDULE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveEvent(event: MaintenanceEvent): void {
  const events = getEvents();
  const index = events.findIndex(e => e.id === event.id);
  if (index >= 0) {
    events[index] = event;
  } else {
    events.push(event);
  }
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(events));
}

export function deleteEvent(id: string): void {
  const events = getEvents().filter(e => e.id !== id);
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(events));
}

export function toggleEventComplete(id: string): void {
  const events = getEvents();
  const idx = events.findIndex(e => e.id === id);
  if (idx >= 0) {
    events[idx].completed = !events[idx].completed;
    events[idx].completedAt = events[idx].completed ? new Date().toISOString() : undefined;
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(events));
  }
}

export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Aliases for MaintenanceForm compatibility ───────────────────────────────
import type { MaintenanceEvent as FullMaintenanceEvent } from '@/types/maintenance';

const FULL_SCHEDULE_KEY = 'maintenance-full-schedule';

export function getMaintenanceEvents(): FullMaintenanceEvent[] {
  try {
    const data = localStorage.getItem(FULL_SCHEDULE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveMaintenanceEvent(event: FullMaintenanceEvent): void {
  const events = getMaintenanceEvents();
  const index = events.findIndex(e => e.id === event.id);
  if (index >= 0) {
    events[index] = event;
  } else {
    events.push(event);
  }
  localStorage.setItem(FULL_SCHEDULE_KEY, JSON.stringify(events));
}

export function deleteMaintenanceEvent(id: string): void {
  const events = getMaintenanceEvents().filter(e => e.id !== id);
  localStorage.setItem(FULL_SCHEDULE_KEY, JSON.stringify(events));
}

export function generateMaintenanceId(): string {
  return `mnt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getUpcomingCount(): number {
  const now = new Date();
  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);

  // Count from both simple events and full maintenance events
  const simpleCount = getEvents().filter(e => {
    if (e.completed) return false;
    const d = new Date(e.date);
    return d >= now && d <= in7;
  }).length;

  const fullCount = getMaintenanceEvents().filter(e => {
    if (e.status === 'completed') return false;
    const d = new Date(e.date);
    return d >= now && d <= in7;
  }).length;

  return simpleCount + fullCount;
}
