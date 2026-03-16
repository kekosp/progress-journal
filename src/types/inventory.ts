export type InventoryStatus = 'in-hand' | 'returned';

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  storageLocation: string;
  receivedDate: string;      // ISO date
  returnByDate?: string;     // ISO date – optional deadline
  returnedDate?: string;     // ISO date – when actually returned
  status: InventoryStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABELS: Record<InventoryStatus, string> = {
  'in-hand': 'In Hand',
  returned: 'Returned',
};
