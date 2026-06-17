// Monthly Performance Report — a single/two-page "report card" PDF summarising
// how the user did in a given month, with a vs-last-month comparison.
// Reuses the design system + savePdf helper already in export-pdf.ts.

import jsPDF from 'jspdf';
import { format } from 'date-fns';
import {
  Report, CATEGORY_LABELS, PRIORITY_LABELS, ReportPriority, ReportCategory,
} from '@/types/report';
import { registerArabicFonts, hasArabic } from './pdf-arabic';
import {
  savePdf, C, RGB, PRIORITY_COLOR, STATUS_COLOR,
  setFill, setTxt, setDrw, setFont, drawText, pill, fmtHours,
} from './export-pdf';

export interface MonthlyStats {
  monthLabel: string;        // "June 2026"
  total: number;
  completed: number;
  inProgress: number;
  draft: number;
  archived: number;
  completionRate: number;    // 0-100
  criticalOpen: number;
  lostTimeHours: number;
  timeInProgressMs: number;
  byCategory: [ReportCategory, number][];
  byPriority: Record<ReportPriority, number>;
  reports: Report[];         // reports created in the month, sorted by date desc
}

/** Build the stats object for a given month from the full reports array. */
export function buildMonthlyStats(allReports: Report[], monthDate: Date): MonthlyStats {
  const key = format(monthDate, 'yyyy-MM');
  const monthReports = allReports
    .filter(r => r.createdAt.startsWith(key))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const completed  = monthReports.filter(r => r.status === 'completed').length;
  const inProgress = monthReports.filter(r => r.status === 'in-progress').length;
  const draft      = monthReports.filter(r => r.status === 'draft').length;
  const archived   = monthReports.filter(r => r.status === 'archived').length;

  const byCategory: Partial<Record<ReportCategory, number>> = {};
  monthReports.forEach(r => { byCategory[r.category] = (byCategory[r.category] ?? 0) + 1; });

  const byPriority: Record<ReportPriority, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  monthReports.forEach(r => { byPriority[r.priority]++; });

  const lostTimeHours = monthReports.reduce((s, r) => s + (r.lostTimeHours ?? 0), 0);
  const timeInProgressMs = monthReports.reduce((s, r) => s + (r.timeInProgressMs ?? 0), 0);

  return {
    monthLabel: format(monthDate, 'MMMM yyyy'),
    total: monthReports.length,
    completed, inProgress, draft, archived,
    completionRate: monthReports.length ? Math.round((completed / monthReports.length) * 100) : 0,
    criticalOpen: monthReports.filter(r => r.priority === 'critical' && r.status !== 'completed').length,
    lostTimeHours,
    timeInProgressMs,
    byCategory: Object.entries(byCategory).sort((a, b) => (b[1] as number) - (a[1] as number)) as [ReportCategory, number][],
    byPriority,
    reports: monthReports,
  };
}

function fmtDurationShort(ms: number): string {
  if (!ms || ms < 60000) return '0h';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Small up/down/flat delta badge text, e.g. "+12%", "-3", "—" */
function delta(curr: number, prev: number, suffix = ''): { text: string; positive: boolean | null } {
  if (prev === 0 && curr === 0) return { text: '—', positive: null };
  const diff = curr - prev;
  if (diff === 0) return { text: '0' + suffix, positive: null };
  return { text: `${diff > 0 ? '+' : ''}${diff}${suffix}`, positive: diff > 0 };
}

export async function exportMonthlyReportToPdf(
  allReports: Report[],
  monthDate: Date,
): Promise<{ saved: boolean; path: string; shared?: boolean }> {
  const stats = buildMonthlyStats(allReports, monthDate);
  const prevMonth = new Date(monthDate); prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevStats = buildMonthlyStats(allReports, prevMonth);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await registerArabicFonts(doc);

  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M  = 16;
  const CW = PW - M * 2;

  // ── Header band ──────────────────────────────────────────────────────────
  setFill(doc, C.navy);    doc.rect(0, 0, PW, 58, 'F');
  setFill(doc, C.navyMid); doc.rect(0, 0, PW, 29, 'F');
  setFill(doc, C.accent);  doc.rect(0, 0, PW, 3,  'F');

  doc.setFontSize(9); setFont(doc, 'bold'); setTxt(doc, C.accentLight);
  doc.text('MONTHLY PERFORMANCE REPORT', M, 16);
  doc.setFontSize(22); setFont(doc, 'bold'); setTxt(doc, C.white);
  doc.text(stats.monthLabel, M, 30);
  doc.setFontSize(9); setFont(doc, 'normal'); setTxt(doc, C.light);
  doc.text(`Generated ${format(new Date(), 'MMM d, yyyy · HH:mm')}`, M, 38);

  // ── KPI row (4 cards) ────────────────────────────────────────────────────
  let y = 70;
  const kpis: { label: string; value: string; sub: string; color: RGB }[] = [
    { label: 'TOTAL REPORTS', value: String(stats.total), sub: deltaSub(stats.total, prevStats.total), color: C.accent },
    { label: 'COMPLETION RATE', value: `${stats.completionRate}%`, sub: deltaSub(stats.completionRate, prevStats.completionRate, '%'), color: C.green },
    { label: 'CRITICAL OPEN', value: String(stats.criticalOpen), sub: deltaSub(stats.criticalOpen, prevStats.criticalOpen, '', true), color: C.red },
    { label: 'LOST TIME', value: fmtHours(stats.lostTimeHours), sub: `${stats.lostTimeHours > prevStats.lostTimeHours ? '▲' : stats.lostTimeHours < prevStats.lostTimeHours ? '▼' : '–'} vs ${fmtHours(prevStats.lostTimeHours)} last mo.`, color: C.orange },
  ];
  const cardW = (CW - 9) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * (cardW + 3);
    setFill(doc, C.subtle); doc.roundedRect(x, y, cardW, 34, 2, 2, 'F');
    setFill(doc, k.color); doc.rect(x, y, cardW, 1.4, 'F');
    doc.setFontSize(6.3); setFont(doc, 'bold'); setTxt(doc, C.mid);
    doc.text(k.label, x + 4, y + 8, { maxWidth: cardW - 8 });
    doc.setFontSize(16); setFont(doc, 'bold'); setTxt(doc, C.dark);
    doc.text(k.value, x + 4, y + 19);
    doc.setFontSize(6.3); setFont(doc, 'normal'); setTxt(doc, C.mid);
    doc.text(k.sub, x + 4, y + 27, { maxWidth: cardW - 8 });
  });
  y += 44;

  // ── Status breakdown (horizontal bar) ───────────────────────────────────
  doc.setFontSize(10); setFont(doc, 'bold'); setTxt(doc, C.dark);
  doc.text('Status Breakdown', M, y);
  y += 6;
  const statusRows: [string, number, RGB][] = [
    ['Completed', stats.completed, STATUS_COLOR.completed],
    ['In Progress', stats.inProgress, STATUS_COLOR['in-progress']],
    ['Draft', stats.draft, STATUS_COLOR.draft],
    ['Archived', stats.archived, STATUS_COLOR.archived],
  ];
  const maxStatus = Math.max(1, ...statusRows.map(r => r[1]));
  statusRows.forEach(([label, count, color]) => {
    doc.setFontSize(7.5); setFont(doc, 'normal'); setTxt(doc, C.charcoal);
    doc.text(label, M, y + 4);
    doc.text(String(count), M + 32, y + 4);
    const barX = M + 40;
    const barMaxW = CW - 40 - 4;
    setFill(doc, C.subtle); doc.roundedRect(barX, y, barMaxW, 5, 1, 1, 'F');
    const w = Math.max(2, (count / maxStatus) * barMaxW);
    setFill(doc, color); doc.roundedRect(barX, y, w, 5, 1, 1, 'F');
    y += 8;
  });
  y += 4;

  // ── Category + Priority side-by-side tables ─────────────────────────────
  const colW = (CW - 8) / 2;
  const catX = M, prioX = M + colW + 8;
  const tableTopY = y;

  doc.setFontSize(10); setFont(doc, 'bold'); setTxt(doc, C.dark);
  doc.text('By Category', catX, y);
  doc.text('By Priority', prioX, y);
  y += 5;
  const catRowsStartY = y, prioRowsStartY = y;

  let cy = catRowsStartY;
  if (stats.byCategory.length === 0) {
    doc.setFontSize(7.5); setFont(doc, 'normal'); setTxt(doc, C.mid);
    doc.text('No reports this month', catX, cy + 4);
    cy += 8;
  } else {
    stats.byCategory.forEach(([cat, count]) => {
      doc.setFontSize(7.5); setFont(doc, 'normal'); setTxt(doc, C.charcoal);
      doc.text(CATEGORY_LABELS[cat], catX, cy + 4, { maxWidth: colW - 14 });
      doc.setFont('helvetica', 'bold');
      doc.text(String(count), catX + colW - 6, cy + 4, { align: 'right' });
      cy += 6.5;
    });
  }

  let py = prioRowsStartY;
  (['critical', 'high', 'medium', 'low'] as ReportPriority[]).forEach(p => {
    const count = stats.byPriority[p];
    if (count === 0) return;
    pill(doc, PRIORITY_LABELS[p], prioX, py + 5.5, PRIORITY_COLOR[p]);
    doc.setFontSize(7.5); setFont(doc, 'bold'); setTxt(doc, C.charcoal);
    doc.text(String(count), prioX + colW - 6, py + 4.5, { align: 'right' });
    py += 9;
  });
  if (stats.total === 0) {
    doc.setFontSize(7.5); setFont(doc, 'normal'); setTxt(doc, C.mid);
    doc.text('—', prioX, py + 4);
    py += 8;
  }

  y = Math.max(cy, py) + 6;

  // ── Time in Progress summary ────────────────────────────────────────────
  setDrw(doc, C.muted); doc.setLineWidth(0.3);
  doc.line(M, y, M + CW, y);
  y += 8;
  doc.setFontSize(10); setFont(doc, 'bold'); setTxt(doc, C.dark);
  doc.text('Time in Progress (auto-tracked)', M, y);
  doc.setFontSize(9); setFont(doc, 'bold'); setTxt(doc, C.accent);
  doc.text(fmtDurationShort(stats.timeInProgressMs), M + CW, y, { align: 'right' });
  y += 10;

  // ── Report list table ────────────────────────────────────────────────────
  if (y > PH - 40) { doc.addPage(); y = M; }
  doc.setFontSize(10); setFont(doc, 'bold'); setTxt(doc, C.dark);
  doc.text(`Reports This Month (${stats.reports.length})`, M, y);
  y += 7;

  if (stats.reports.length === 0) {
    doc.setFontSize(8); setFont(doc, 'normal'); setTxt(doc, C.mid);
    doc.text('No reports were created this month.', M, y);
  } else {
    // header row
    setFill(doc, C.subtle); doc.rect(M, y - 4, CW, 7, 'F');
    doc.setFontSize(7); setFont(doc, 'bold'); setTxt(doc, C.mid);
    doc.text('DATE', M + 2, y);
    doc.text('TITLE', M + 22, y);
    doc.text('CATEGORY', M + CW * 0.55, y);
    doc.text('PRIORITY', M + CW * 0.74, y);
    doc.text('STATUS', M + CW * 0.90, y);
    y += 6;

    for (const r of stats.reports) {
      if (y > PH - 18) { doc.addPage(); y = M + 6; }
      doc.setFontSize(7.2); setFont(doc, 'normal'); setTxt(doc, C.charcoal);
      doc.text(format(new Date(r.createdAt), 'MMM d'), M + 2, y);
      doc.text(r.title, M + 22, y, { maxWidth: CW * 0.32 });
      doc.setFontSize(6.6); setTxt(doc, C.mid);
      doc.text(CATEGORY_LABELS[r.category], M + CW * 0.55, y, { maxWidth: CW * 0.18 });
      pill(doc, PRIORITY_LABELS[r.priority], M + CW * 0.74, y + 2.2, PRIORITY_COLOR[r.priority]);
      pill(doc, r.status.replace('-', ' '), M + CW * 0.90, y + 2.2, STATUS_COLOR[r.status]);
      y += 7.5;
      setDrw(doc, C.subtle); doc.setLineWidth(0.2);
      doc.line(M, y - 4.5, M + CW, y - 4.5);
    }
  }

  // ── Footer on every page ─────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7); setFont(doc, 'normal'); setTxt(doc, C.light);
    doc.text(`Page ${p} of ${pageCount}`, PW - M, PH - 8, { align: 'right' });
    doc.text('Progress Journal', M, PH - 8);
  }

  const filename = `monthly-report-${format(monthDate, 'yyyy-MM')}.pdf`;
  return savePdf(doc, filename);
}

function deltaSub(curr: number, prev: number, suffix = '', lowerIsBetter = false): string {
  if (prev === 0 && curr === 0) return 'No change';
  const diff = curr - prev;
  const arrow = diff === 0 ? '–' : diff > 0 ? '▲' : '▼';
  const sign = diff > 0 ? '+' : '';
  return `${arrow} ${sign}${diff}${suffix} vs last mo.`;
}
