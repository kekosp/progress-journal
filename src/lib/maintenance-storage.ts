// ─── Maintenance Storage ──────────────────────────────────────────────────────
// Single source of truth for all maintenance events.
// Previously there were two separate keys ('maintenance-schedule' and
// 'maintenance-full-schedule'). A startup migration merges them once.

import { logActivity } from '@/lib/activity-log';
import type { MaintenanceEvent as LegacyFullEvent } from '@/types/maintenance';

const SCHEDULE_KEY = 'maintenance-schedule';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';
export type MaintenanceCategory =
  | 'inspection' | 'maintenance' | 'safety'
  | 'quality' | 'progress' | 'incident' | 'other';
export type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface MaintenanceEvent {
  id: string;
  title: string;
  description?: string;
  date: string;        // YYYY-MM-DD
  time?: string;       // HH:MM (24h)
  category: MaintenanceCategory;
  priority: MaintenancePriority;
  completed: boolean;
  completedAt?: string;
  // Extended fields (from former "full" type)
  status?: 'planned' | 'in-progress' | 'completed' | 'postponed';
  equipment?: string;
  assignedTo?: string;
  duration?: number;   // minutes
  // Recurring
  repeat?: RepeatFrequency;
  repeatEndDate?: string;
  repeatParentId?: string;
}

// ─── Shared display constants (single source of truth) ───────────────────────

export const CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  inspection: 'Inspection',
  maintenance: 'Maintenance',
  safety: 'Safety',
  quality: 'Quality',
  progress: 'Progress',
  incident: 'Incident',
  other: 'Other',
};

export const PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const PRIORITY_COLORS: Record<MaintenancePriority, string> = {
  low:      'bg-blue-400/80',
  medium:   'bg-yellow-400/80',
  high:     'bg-orange-500/80',
  critical: 'bg-red-500/80',
};

export const PRIORITY_BORDER: Record<MaintenancePriority, string> = {
  low:      'border-blue-400',
  medium:   'border-yellow-400',
  high:     'border-orange-500',
  critical: 'border-red-500',
};

// ─── Module-level cache ───────────────────────────────────────────────────────
// Avoids repeated JSON.parse on every render while keeping reads synchronous.

let _cache: MaintenanceEvent[] | null = null;

function invalidate() { _cache = null; }

function read(): MaintenanceEvent[] {
  if (_cache) return _cache;
  try {
    const data = localStorage.getItem(SCHEDULE_KEY);
    _cache = data ? JSON.parse(data) : [];
  } catch {
    _cache = [];
  }
  return _cache!;
}

function write(events: MaintenanceEvent[]) {
  _cache = events;
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(events));
}

// ─── One-time migration: merge legacy 'maintenance-full-schedule' ─────────────

export function migrateMaintenanceStorage(): void {
  const LEGACY_KEY = 'maintenance-full-schedule';
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  try {
    const legacy: LegacyFullEvent[] = JSON.parse(raw);
    if (!legacy.length) { localStorage.removeItem(LEGACY_KEY); return; }
    const existing = read();
    const existingIds = new Set(existing.map(e => e.id));
    let added = 0;
    for (const e of legacy) {
      if (existingIds.has(e.id)) continue;
      existing.push({
        id: e.id,
        title: e.title,
        description: e.description || undefined,
        date: e.date.slice(0, 10),
        time: e.time || undefined,
        category: 'maintenance',
        priority: e.priority,
        completed: e.status === 'completed',
        completedAt: e.status === 'completed' ? e.updatedAt : undefined,
        status: e.status,
        equipment: e.equipment || undefined,
        assignedTo: e.assignedTo || undefined,
        duration: e.duration || undefined,
      });
      added++;
    }
    if (added > 0) write(existing);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    localStorage.removeItem(LEGACY_KEY);
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export function getEvents(): MaintenanceEvent[] {
  return read();
}

export function saveEvent(event: MaintenanceEvent): void {
  const events = read();
  const index = events.findIndex(e => e.id === event.id);
  if (index >= 0) {
    events[index] = event;
    logActivity('maintenance', 'updated', event.id, event.title);
  } else {
    events.push(event);
    logActivity('maintenance', 'created', event.id, event.title, `${event.category} • ${event.priority}`);
  }
  write(events);
}

export function deleteEvent(id: string): void {
  const events = read();
  const target = events.find(e => e.id === id);
  if (target) logActivity('maintenance', 'deleted', id, target.title);
  write(events.filter(e => e.id !== id));
}

export function deleteEventSeries(id: string): void {
  const events = read();
  const target = events.find(e => e.id === id);
  if (!target) return;
  const parentId = target.repeatParentId ?? id;
  logActivity('maintenance', 'deleted', id, target.title);
  write(events.filter(e => e.id !== parentId && e.repeatParentId !== parentId));
}

export function saveRecurringEvent(event: MaintenanceEvent): void {
  const events = read();
  const cleaned = events.filter(e => e.repeatParentId !== event.id);
  const idx = cleaned.findIndex(e => e.id === event.id);
  if (idx >= 0) cleaned[idx] = event; else cleaned.push(event);

  const children: MaintenanceEvent[] = [];
  if (event.repeat && event.repeat !== 'none') {
    const endDate = event.repeatEndDate ? new Date(event.repeatEndDate) : null;
    let current = new Date(event.date);
    for (let i = 0; i < 365; i++) {
      if (event.repeat === 'daily')        current.setDate(current.getDate() + 1);
      else if (event.repeat === 'weekly')  current.setDate(current.getDate() + 7);
      else if (event.repeat === 'monthly') current.setMonth(current.getMonth() + 1);
      if (endDate && current > endDate) break;
      if (!endDate && i >= 11) break;
      children.push({
        ...event,
        id: `${event.id}_r${i + 1}`,
        date: current.toISOString().slice(0, 10),
        completed: false,
        completedAt: undefined,
        repeat: undefined,
        repeatEndDate: undefined,
        repeatParentId: event.id,
      });
    }
    logActivity('maintenance', 'created', event.id, event.title,
      `Recurring ${event.repeat} · ${children.length + 1} events`);
  } else {
    logActivity('maintenance', 'created', event.id, event.title, `${event.category} • ${event.priority}`);
  }
  write([...cleaned, ...children]);
}

export function toggleEventComplete(id: string): void {
  const events = read();
  const idx = events.findIndex(e => e.id === id);
  if (idx < 0) return;
  events[idx].completed = !events[idx].completed;
  events[idx].completedAt = events[idx].completed ? new Date().toISOString() : undefined;
  logActivity('maintenance', events[idx].completed ? 'completed' : 'updated', id, events[idx].title);
  write(events);
}

export function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Aliases kept for MaintenanceForm backward-compatibility ──────────────────
export const getMaintenanceEvents = getEvents;
export const deleteMaintenanceEvent = deleteEvent;
export const generateMaintenanceId = generateEventId;

export function saveMaintenanceEvent(event: LegacyFullEvent): void {
  saveEvent({
    id: event.id,
    title: event.title,
    description: event.description || undefined,
    date: event.date.slice(0, 10),
    time: event.time || undefined,
    category: 'maintenance',
    priority: event.priority,
    completed: event.status === 'completed',
    status: event.status,
    equipment: event.equipment || undefined,
    assignedTo: event.assignedTo || undefined,
    duration: event.duration || undefined,
  });
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

export function getUpcomingCount(): number {
  const now = new Date();
  const in7 = new Date(now);
  in7.setDate(in7.getDate() + 7);
  return read().filter(e => {
    if (e.completed || e.status === 'completed') return false;
    const d = new Date(e.date);
    return d >= now && d <= in7;
  }).length;
}

export interface UpcomingAlert {
  title: string;
  date: string;
  priority: string;
  isToday: boolean;
}

export function getDueSoonEvents(): UpcomingAlert[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return read()
    .filter(e => !e.completed && e.status !== 'completed')
    .flatMap(e => {
      const d = e.date.slice(0, 10);
      if (d !== todayStr && d !== tomorrowStr) return [];
      return [{ title: e.title, date: e.date, priority: e.priority, isToday: d === todayStr }];
    });
}

export function getUpcomingEvents(limit = 5): MaintenanceEvent[] {
  const today = new Date().toISOString().slice(0, 10);
  return read()
    .filter(e => !e.completed && e.date >= today)
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.time ?? '99:99').localeCompare(b.time ?? '99:99');
    })
    .slice(0, limit);
}

export function getReportsForDate(date: string): string[] {
  // returns report IDs linked by date — sourced from report storage
  try {
    const reports = JSON.parse(localStorage.getItem('reports') ?? '[]');
    return reports
      .filter((r: { createdAt: string }) => r.createdAt.slice(0, 10) === date)
      .map((r: { id: string }) => r.id);
  } catch { return []; }
}
