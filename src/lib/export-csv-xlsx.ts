import { Report, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/types/report';
import { InventoryItem } from '@/types/inventory';
import * as XLSX from 'xlsx';
import { logActivity } from '@/lib/activity-log';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Reports ──────────────────────────────────────────────────────────────────

function reportsToRows(reports: Report[]) {
  return reports.map(r => ({
    Title: r.title,
    Category: CATEGORY_LABELS[r.category],
    Priority: PRIORITY_LABELS[r.priority],
    Status: STATUS_LABELS[r.status],
    Project: r.projectName || '',
    Location: r.location || '',
    Description: r.description,
    Notes: r.notes,
    'Images Count': r.images.length,
    'Lost Time (h)': r.lostTimeHours ?? '',
    'Signed By': r.signedBy || '',
    'Signed At': r.signedAt ? new Date(r.signedAt).toLocaleString() : '',
    Created: new Date(r.createdAt).toLocaleString(),
    Updated: new Date(r.updatedAt).toLocaleString(),
  }));
}

export function exportReportsCsv(reports: Report[]) {
  const rows = reportsToRows(reports);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(new Blob([csv], { type: 'text/csv' }), `reports-${new Date().toISOString().slice(0, 10)}.csv`);
  logActivity('report', 'exported', 'batch', `${reports.length} reports`, 'CSV');
}

export function exportReportsXlsx(reports: Report[]) {
  const rows = reportsToRows(reports);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map(key => {
    const maxLen = Math.max(key.length, ...rows.map(r => String((r as any)[key] || '').length));
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Reports');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `reports-${new Date().toISOString().slice(0, 10)}.xlsx`);
  logActivity('report', 'exported', 'batch', `${reports.length} reports`, 'Excel');
}

// ─── Inventory ────────────────────────────────────────────────────────────────

function inventoryToRows(items: InventoryItem[]) {
  return items.map(i => ({
    Name: i.name,
    'Serial Number': i.serialNumber || '',
    Quantity: i.quantity,
    Status: i.status === 'in-hand' ? 'In Hand' : 'Returned',
    'Taken From': i.takenFrom,
    'Returned To': i.returnedTo || '',
    'Received Date': i.receivedDate,
    'Return By': i.returnByDate || '',
    'Returned Date': i.returnedDate || '',
    Notes: i.notes || '',
    'Serviced Outside': i.servicedOutside ? 'Yes' : 'No',
    'Service Location': i.serviceLocation || '',
    'Service Sent On': i.serviceStartDate || '',
    'Service Expected Return': i.serviceReturnDate || '',
    'Service Actual Return': i.serviceActualReturnDate || '',
    Created: new Date(i.createdAt).toLocaleString(),
    Updated: new Date(i.updatedAt).toLocaleString(),
  }));
}

export function exportInventoryCsv(items: InventoryItem[]) {
  const rows = inventoryToRows(items);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  downloadBlob(new Blob([csv], { type: 'text/csv' }), `inventory-${new Date().toISOString().slice(0, 10)}.csv`);
  logActivity('inventory', 'exported', 'batch', `${items.length} items`, 'CSV');
}

export function exportInventoryXlsx(items: InventoryItem[]) {
  const rows = inventoryToRows(items);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = Object.keys(rows[0] || {}).map(key => {
    const maxLen = Math.max(key.length, ...rows.map(r => String((r as any)[key] || '').length));
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `inventory-${new Date().toISOString().slice(0, 10)}.xlsx`);
  logActivity('inventory', 'exported', 'batch', `${items.length} items`, 'Excel');
}
