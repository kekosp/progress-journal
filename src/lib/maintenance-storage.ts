import { MaintenanceEvent } from '@/types/maintenance';

const STORAGE_KEY = 'pvp-maintenance';

export function getMaintenanceEvents(): MaintenanceEvent[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveMaintenanceEvent(event: MaintenanceEvent): void {
  const events = getMaintenanceEvents();
  const index = events.findIndex(e => e.id === event.id);
  if (index >= 0) {
    events[index] = { ...event, updatedAt: new Date().toISOString() };
  } else {
    events.unshift(event);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export function deleteMaintenanceEvent(id: string): void {
  const events = getMaintenanceEvents().filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

export function getMaintenanceById(id: string): MaintenanceEvent | undefined {
  return getMaintenanceEvents().find(e => e.id === id);
}

export function generateMaintenanceId(): string {
  return `mnt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getEventsForDate(date: string): MaintenanceEvent[] {
  return getMaintenanceEvents().filter(e => e.date === date);
}

export function getEventsForMonth(year: number, month: number): MaintenanceEvent[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return getMaintenanceEvents().filter(e => e.date.startsWith(prefix));
}
