// ─── Maintenance Schedule Storage ────────────────────────────────────────────
import { logActivity } from '@/lib/activity-log';
const SCHEDULE_KEY = 'maintenance-schedule';

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';
export type MaintenanceCategory = 'inspection' | 'maintenance' | 'safety' | 'quality' | 'progress' | 'incident' | 'other';

export type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface MaintenanceEvent {
  id: string;
  title: string;
  description?: string;
  date: string; // ISO date string YYYY-MM-DD
  time?: string; // HH:MM (24h), optional
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  completed: boolean;
  completedAt?: string;
  // Recurring
  repeat?: RepeatFrequency;
  repeatEndDate?: string; // YYYY-MM-DD — stop generating after this date
  repeatParentId?: string; // child events reference their parent
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
    logActivity('maintenance', 'updated', event.id, event.title);
  } else {
    events.push(event);
    logActivity('maintenance', 'created', event.id, event.title, `${event.category} • ${event.priority}`);
  }
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(events));
}

export function deleteEvent(id: string): void {
  const events = getEvents();
  const target = events.find(e => e.id === id);
  if (target) logActivity('maintenance', 'deleted', id, target.title);
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(events.filter(e => e.id !== id)));
}

/** Delete an event AND all child events that share the same repeatParentId. */
export function deleteEventSeries(id: string): void {
  const events = getEvents();
  const target = events.find(e => e.id === id);
  if (!target) return;
  const parentId = target.repeatParentId ?? id;
  const remaining = events.filter(e => e.id !== parentId && e.repeatParentId !== parentId);
  logActivity('maintenance', 'deleted', id, target.title);
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(remaining));
}

/** Save a parent event + auto-generate its recurring child events. */
export function saveRecurringEvent(event: MaintenanceEvent): void {
  const events = getEvents();

  // Remove any previously generated children of this event (in case user edits)
  const cleaned = events.filter(e => e.repeatParentId !== event.id);

  // Save / update the parent
  const idx = cleaned.findIndex(e => e.id === event.id);
  if (idx >= 0) cleaned[idx] = event;
  else cleaned.push(event);

  // Generate children if repeat is set
  if (event.repeat && event.repeat !== 'none') {
    const children: MaintenanceEvent[] = [];
    const endDate = event.repeatEndDate ? new Date(event.repeatEndDate) : null;
    let current = new Date(event.date);
    const MAX = 365; // safety cap

    for (let i = 0; i < MAX; i++) {
      // advance by frequency
      if (event.repeat === 'daily') current.setDate(current.getDate() + 1);
      else if (event.repeat === 'weekly') current.setDate(current.getDate() + 7);
      else if (event.repeat === 'monthly') current.setMonth(current.getMonth() + 1);

      if (endDate && current > endDate) break;
      if (!endDate && i >= 11) break; // default: generate 12 occurrences max

      const dateStr = current.toISOString().slice(0, 10);
      children.push({
        ...event,
        id: `${event.id}_r${i + 1}`,
        date: dateStr,
        completed: false,
        completedAt: undefined,
        repeat: undefined,
        repeatEndDate: undefined,
        repeatParentId: event.id,
      });
    }

    cleaned.push(...children);
    logActivity('maintenance', 'created', event.id, event.title,
      `Recurring ${event.repeat} · ${children.length + 1} events`);
  } else {
    logActivity('maintenance', 'created', event.id, event.title, `${event.category} • ${event.priority}`);
  }

  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(cleaned));
}

export function toggleEventComplete(id: string): void {
  const events = getEvents();
  const idx = events.findIndex(e => e.id === id);
  if (idx >= 0) {
    events[idx].completed = !events[idx].completed;
    events[idx].completedAt = events[idx].completed ? new Date().toISOString() : undefined;
    logActivity('maintenance', events[idx].completed ? 'completed' : 'updated', id, events[idx].title);
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
    logActivity('maintenance', 'updated', event.id, event.title);
  } else {
    events.push(event);
    logActivity('maintenance', 'created', event.id, event.title);
  }
  localStorage.setItem(FULL_SCHEDULE_KEY, JSON.stringify(events));
}

export function deleteMaintenanceEvent(id: string): void {
  const events = getMaintenanceEvents();
  const target = events.find(e => e.id === id);
  if (target) logActivity('maintenance', 'deleted', id, target.title);
  localStorage.setItem(FULL_SCHEDULE_KEY, JSON.stringify(events.filter(e => e.id !== id)));
}

export function generateMaintenanceId(): string {
  return `mnt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getUpcomingCount(): number {
  const now = new Date();
  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);

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

export interface UpcomingAlert {
  title: string;
  date: string;
  priority: string;
  isToday: boolean;
}

export function getDueSoonEvents(): UpcomingAlert[] {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const alerts: UpcomingAlert[] = [];

  getEvents().forEach(e => {
    if (e.completed) return;
    const d = e.date.slice(0, 10);
    if (d === todayStr || d === tomorrowStr) {
      alerts.push({ title: e.title, date: e.date, priority: e.priority, isToday: d === todayStr });
    }
  });

  getMaintenanceEvents().forEach(e => {
    if (e.status === 'completed') return;
    const d = e.date.slice(0, 10);
    if (d === todayStr || d === tomorrowStr) {
      alerts.push({ title: e.title, date: e.date, priority: e.priority, isToday: d === todayStr });
    }
  });

  return alerts;
}
