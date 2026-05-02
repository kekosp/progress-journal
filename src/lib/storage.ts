import { Report } from '@/types/report';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-log';

const STORAGE_KEY = 'reports-data';
const EXPORT_VERSION = 1;

// ─── Zod schema for validating imported reports ──────────────────────────────

const reportImageSchema = z.object({
  id: z.string().max(100),
  dataUrl: z.string().max(2_000_000), // ~1.5MB base64
  caption: z.string().max(500).optional(),
  timestamp: z.string(),
  annotatedDataUrl: z.string().max(2_000_000).optional(),
});

const reportSchema = z.object({
  id: z.string().max(100),
  title: z.string().min(1).max(500),
  description: z.string().max(10_000),
  category: z.enum(['inspection', 'maintenance', 'safety', 'quality', 'progress', 'incident', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['draft', 'in-progress', 'completed', 'archived']),
  images: z.array(reportImageSchema).max(50),
  notes: z.string().max(5_000),
  createdAt: z.string(),
  updatedAt: z.string(),
  projectName: z.string().max(300).optional(),
  location: z.string().max(300).optional(),
  signatureDataUrl: z.string().max(500_000).optional(),
  signedBy: z.string().max(200).optional(),
  signedAt: z.string().optional(),
  lostTimeHours: z.number().min(0).max(9999).optional(),
  lostTimeMinutes: z.number().min(0).max(59).optional(),
  inProgressStartedAt: z.string().optional(),
  timeInProgressMs: z.number().min(0).optional(),
}).strict();

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
    const old = reports[index];
    // ─── Auto-track time spent in 'in-progress' ─────────────────────────────
    const now = new Date();
    let inProgressStartedAt = report.inProgressStartedAt ?? old.inProgressStartedAt;
    let timeInProgressMs = report.timeInProgressMs ?? old.timeInProgressMs ?? 0;
    if (report.status !== old.status) {
      // Leaving in-progress → accumulate elapsed
      if (old.status === 'in-progress' && old.inProgressStartedAt) {
        timeInProgressMs += Math.max(0, now.getTime() - new Date(old.inProgressStartedAt).getTime());
        inProgressStartedAt = undefined;
      }
      // Entering in-progress → start the clock
      if (report.status === 'in-progress') {
        inProgressStartedAt = now.toISOString();
      }
    }
    reports[index] = {
      ...report,
      inProgressStartedAt,
      timeInProgressMs,
      updatedAt: now.toISOString(),
    };
    // Detect specific changes
    if (report.status !== old.status) {
      if (report.status === 'completed') logActivity('report', 'completed', report.id, report.title);
      else if (report.status === 'archived') logActivity('report', 'archived', report.id, report.title);
      else logActivity('report', 'updated', report.id, report.title, `Status → ${report.status}`);
    } else if (report.signatureDataUrl && !old.signatureDataUrl) {
      logActivity('report', 'signed', report.id, report.title, `Signed by ${report.signedBy || 'unknown'}`);
    } else {
      logActivity('report', 'updated', report.id, report.title);
    }
  } else {
    // New report — start the clock if it's created already in-progress
    const seeded: Report = {
      ...report,
      timeInProgressMs: report.timeInProgressMs ?? 0,
      inProgressStartedAt:
        report.status === 'in-progress'
          ? (report.inProgressStartedAt ?? new Date().toISOString())
          : undefined,
    };
    reports.unshift(seeded);
    logActivity('report', 'created', report.id, report.title, `${report.category} • ${report.priority}`);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}

export function deleteReport(id: string): void {
  const reports = getReports();
  const target = reports.find(r => r.id === id);
  if (target) logActivity('report', 'deleted', id, target.title);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.filter(r => r.id !== id)));
}

export function getReportById(id: string): Report | undefined {
  return getReports().find(r => r.id === id);
}

export function generateId(): string {
  return `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Time-in-progress helpers ────────────────────────────────────────────────

/**
 * Returns the total time (in ms) a report has spent in the 'in-progress' status,
 * including the currently-running session if it's still in-progress.
 */
export function getTimeInProgressMs(report: Report, now: Date = new Date()): number {
  const base = report.timeInProgressMs ?? 0;
  if (report.status === 'in-progress' && report.inProgressStartedAt) {
    return base + Math.max(0, now.getTime() - new Date(report.inProgressStartedAt).getTime());
  }
  return base;
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
  logActivity('report', 'exported', 'batch', `${reports.length} reports`, filePath);

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error('Invalid JSON file.');
  }

  if (typeof parsed !== 'object' || parsed === null || !('reports' in parsed)) {
    throw new Error('Invalid backup file: missing reports array.');
  }

  const raw = (parsed as Record<string, unknown>).reports;
  if (!Array.isArray(raw)) {
    throw new Error('Invalid backup file: reports is not an array.');
  }

  // Validate each report against the schema
  const validReports: Report[] = [];
  const errors: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const result = reportSchema.safeParse(raw[i]);
    if (result.success) {
      validReports.push(result.data as Report);
    } else {
      const msg = result.error.issues.map(is => is.path.join('.') + ': ' + is.message).join('; ');
      errors.push(`Report #${i + 1}: ${msg}`);
    }
  }

  if (validReports.length === 0 && raw.length > 0) {
    throw new Error(`All ${raw.length} report(s) failed validation. ${errors[0]}`);
  }

  if (mode === 'replace') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validReports));
    logActivity('report', 'imported', 'batch', `${validReports.length} reports`, `Mode: replace`);
    return validReports.length;
  }

  // merge — only add reports whose IDs don't already exist
  const existing = getReports();
  const existingIds = new Set(existing.map(r => r.id));
  const incoming = validReports.filter(r => !existingIds.has(r.id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...incoming, ...existing]));
  if (incoming.length > 0) logActivity('report', 'imported', 'batch', `${incoming.length} reports`, `Mode: merge`);
  return incoming.length;
}
