import { InventoryItem } from '@/types/inventory';

const STORAGE_KEY = 'inventory-data';

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
    items[index] = { ...item, updatedAt: new Date().toISOString() };
  } else {
    items.unshift(item);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function deleteInventoryItem(id: string): void {
  const items = getInventoryItems().filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
