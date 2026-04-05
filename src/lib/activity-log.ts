// ─── Activity Log ─────────────────────────────────────────────────────────────

const LOG_KEY = 'activity-log';
const MAX_ENTRIES = 500;

export type ActivityModule = 'report' | 'maintenance' | 'inventory';
export type ActivityAction = 'created' | 'updated' | 'deleted' | 'completed' | 'archived' | 'returned' | 'exported' | 'imported' | 'signed';

export interface ActivityEntry {
  id: string;
  module: ActivityModule;
  action: ActivityAction;
  itemId: string;
  itemTitle: string;
  details?: string;
  timestamp: string;
}

export function getActivityLog(): ActivityEntry[] {
  try {
    const data = localStorage.getItem(LOG_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function logActivity(
  module: ActivityModule,
  action: ActivityAction,
  itemId: string,
  itemTitle: string,
  details?: string,
): void {
  const entries = getActivityLog();
  entries.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    module,
    action,
    itemId,
    itemTitle,
    details,
    timestamp: new Date().toISOString(),
  });
  // Keep only the most recent entries
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  localStorage.setItem(LOG_KEY, JSON.stringify(entries));
}

export function clearActivityLog(): void {
  localStorage.removeItem(LOG_KEY);
}
