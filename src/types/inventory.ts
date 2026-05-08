export type InventoryStatus = 'in-hand' | 'returned';

export interface InventoryItem {
  id: string;
  name: string;
  serialNumber?: string;
  serialNumbers?: string[]; // per-unit serial numbers when quantity > 1
  quantity: number;
  takenFrom: string;          // where the item was taken from
  returnedTo?: string;        // where the item was put back
  receivedDate: string;       // ISO date
  returnByDate?: string;      // ISO date – optional deadline
  returnedDate?: string;      // ISO date – when actually returned
  status: InventoryStatus;
  notes?: string;
  servicedOutside?: boolean;
  serviceLocation?: string;     // where it's being serviced
  serviceReturnDate?: string;   // ISO date – expected return from service
  serviceStartDate?: string;    // ISO date – actual date sent for service
  serviceActualReturnDate?: string; // ISO date – actual date returned from service
  createdAt: string;
  updatedAt: string;
}

export const STATUS_LABELS: Record<InventoryStatus, string> = {
  'in-hand': 'In Hand',
  returned: 'Returned',
};
