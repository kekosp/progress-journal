import { Report } from '@/types/report';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const STORAGE_KEY = 'reports-data';
const EXPORT_VERSION = 1;

// ─── Core CRUD ────────────────────────────────────────────────────────────────

export function getReports(): Report[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveReport(report: Report): void {
  const reports = getReports();
  const index = reports.findIndex(r => r.id === report.id);
  if (index >= 0) {
    reports[index] = { ...report, updatedAt: new Date().toISOString() };
  } else {
    reports.unshift(report);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function deleteReport(id: string): void {
  const reports = getReports().filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function getReportById(id: string): Report | undefined {
  return getReports().find(r => r.id === id);
}

export function generateId(): string {
  return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Data Transfer ────────────────────────────────────────────────────────────

export interface ExportBundle {
  version: number;
  exportedAt: string;
  reportCount: number;
  reports: Report[];
}

export type ImportMode = 'merge' | 'replace';

interface ExportOptions {
  /** If true, opens the Android native share sheet after saving the file */
  share?: boolean;
}

/**
 * Saves all reports as a .json file to the device's Downloads folder.
 * If `share: true`, also opens the Android share sheet so the user can
 * send it via WhatsApp, Bluetooth, email, etc.
 * Returns the saved file path.
 */
export async function exportAllData(options: ExportOptions = {}): Promise<string> {
  const reports = getReports();
  const bundle: ExportBundle = {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    reportCount: reports.length,
    reports,
  };

  const json = JSON.stringify(bundle, null, 2);
  const filename = `reports-backup-${new Date().toISOString().slice(0, 10)}.json`;

  // Write to the public Downloads directory so the user can see it in Files
  await Filesystem.writeFile({
    path: filename,
    data: json,
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true,
  });

  const filePath = filename;

  if (options.share) {
    // Get a content:// URI so Android apps can read it
    const uriResult = await Filesystem.getUri({
      path: filePath,
      directory: Directory.Data,
    });
    await Share.share({
      title: 'Reports Backup',
      text: `${reports.length} report${reports.length !== 1 ? 's' : ''} — ${new Date().toLocaleDateString()}`,
      url: uriResult.uri,
      dialogTitle: 'Send backup to another device',
    });
  }

  return filePath;
}

/**
 * Import reports from a JSON string.
 * - merge:   keeps existing reports, only adds ones with new IDs
 * - replace: wipes storage and replaces with imported data
 * Returns number of reports actually written.
 */
export function importData(jsonText: string, mode: ImportMode = 'merge'): number {
  const bundle: ExportBundle = JSON.parse(jsonText);

  if (!bundle.reports || !Array.isArray(bundle.reports)) {
    throw new Error('Invalid backup file: missing reports array.');
  }

  if (mode === 'replace') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle.reports));
    return bundle.reports.length;
  }

  // merge — only add reports whose IDs don't already exist
  const existing = getReports();
  const existingIds = new Set(existing.map(r => r.id));
  const incoming = bundle.reports.filter(r => !existingIds.has(r.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...incoming, ...existing]));
  return incoming.length;
}
