import { InventoryItem } from '@/types/inventory';
import { logActivity } from '@/lib/activity-log';
import { getEvents, saveEvent, deleteEvent, MaintenanceEvent } from '@/lib/maintenance-storage';

const STORAGE_KEY = 'inventory-data';

/** Mirror an item's expected service-return date as a maintenance calendar event. */
function syncServiceCalendarEvent(item: InventoryItem): void {
  const eventId = `svc_${item.id}`;
  const events = getEvents();
  const existing = events.find(e => e.id === eventId);
  const shouldExist = !!(item.servicedOutside && item.serviceReturnDate && !item.serviceActualReturnDate && item.status === 'in-hand');

  if (!shouldExist) {
    if (existing) deleteEvent(eventId);
    return;
  }

  const event: MaintenanceEvent = {
    id: eventId,
    title: `Service return: ${item.name}`,
    description: `Expected back from ${item.serviceLocation ?? 'service'}${item.serialNumber ? ` (SN: ${item.serialNumber})` : ''}`,
    date: item.serviceReturnDate!.slice(0, 10),
    category: 'maintenance',
    priority: 'high',
    completed: existing?.completed ?? false,
    completedAt: existing?.completedAt,
  };
  saveEvent(event);
}

export function getInventoryItems(): InventoryItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveInventoryItem(item: InventoryItem): void {
  const items = getInventoryItems();
  const index = items.findIndex(i => i.id === item.id);
  if (index >= 0) {
    const old = items[index];
    items[index] = { ...item, updatedAt: new Date().toISOString() };
    if (item.status === 'returned' && old.status !== 'returned') {
      logActivity('inventory', 'returned', item.id, item.name, item.returnedTo ? `To: ${item.returnedTo}` : undefined);
    } else if (item.servicedOutside && !old.servicedOutside) {
      logActivity('inventory', 'service-sent', item.id, item.name,
        `${item.serviceLocation ?? ''}${item.serviceStartDate ? ` on ${item.serviceStartDate}` : ''}`.trim() || undefined);
    } else if (!item.servicedOutside && old.servicedOutside) {
      logActivity('inventory', 'service-returned', item.id, item.name,
        item.serviceActualReturnDate ? `Returned ${item.serviceActualReturnDate}` : undefined);
    } else if (item.servicedOutside && old.servicedOutside && item.serviceActualReturnDate && !old.serviceActualReturnDate) {
      logActivity('inventory', 'service-returned', item.id, item.name, `Returned ${item.serviceActualReturnDate}`);
    } else {
      logActivity('inventory', 'updated', item.id, item.name);
    }
  } else {
    items.unshift(item);
    logActivity('inventory', 'created', item.id, item.name, `Qty: ${item.quantity} from ${item.takenFrom}`);
    if (item.servicedOutside) {
      logActivity('inventory', 'service-sent', item.id, item.name,
        `${item.serviceLocation ?? ''}${item.serviceStartDate ? ` on ${item.serviceStartDate}` : ''}`.trim() || undefined);
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  syncServiceCalendarEvent(item);
}

export function deleteInventoryItem(id: string): void {
  const items = getInventoryItems();
  const target = items.find(i => i.id === id);
  if (target) logActivity('inventory', 'deleted', id, target.name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.filter(i => i.id !== id)));
  // Remove any linked service calendar event
  const eventId = `svc_${id}`;
  if (getEvents().some(e => e.id === eventId)) deleteEvent(eventId);
}

export function getInventoryItemById(id: string): InventoryItem | undefined {
  return getInventoryItems().find(i => i.id === id);
}

export function generateInventoryId(): string {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Count items that are in-hand and due back within the next 7 days (or overdue). */
export function getInventoryDueCount(): number {
  const items = getInventoryItems().filter(i => i.status === 'in-hand' && i.returnByDate);
  const now = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(now.getDate() + 7);

  return items.filter(i => {
    const due = new Date(i.returnByDate!);
    return due <= weekFromNow;
  }).length;
}

export interface InventoryAlert {
  item: InventoryItem;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
}

/** Get items due today, tomorrow, or overdue — for toast notifications. */
export function getDueSoonInventory(): InventoryAlert[] {
  const items = getInventoryItems().filter(i => i.status === 'in-hand' && i.returnByDate);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const alerts: InventoryAlert[] = [];
  for (const item of items) {
    const due = item.returnByDate!.slice(0, 10);
    if (due < today) {
      alerts.push({ item, isOverdue: true, isToday: false, isTomorrow: false });
    } else if (due === today) {
      alerts.push({ item, isOverdue: false, isToday: true, isTomorrow: false });
    } else if (due === tomorrow) {
      alerts.push({ item, isOverdue: false, isToday: false, isTomorrow: true });
    }
  }
  return alerts;
}

/** Items currently out for service whose expected return date is today or overdue. */
export function getDueSoonService(): InventoryAlert[] {
  const items = getInventoryItems().filter(i =>
    i.status === 'in-hand' && i.servicedOutside && !i.serviceActualReturnDate && i.serviceReturnDate
  );
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const alerts: InventoryAlert[] = [];
  for (const item of items) {
    const due = item.serviceReturnDate!.slice(0, 10);
    if (due < today) alerts.push({ item, isOverdue: true, isToday: false, isTomorrow: false });
    else if (due === today) alerts.push({ item, isOverdue: false, isToday: true, isTomorrow: false });
    else if (due === tomorrow) alerts.push({ item, isOverdue: false, isToday: false, isTomorrow: true });
  }
  return alerts;
}
