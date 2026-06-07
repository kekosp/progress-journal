import jsPDF from 'jspdf';
import { Report, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/types/report';
import { format } from 'date-fns';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { registerArabicFonts, hasArabic, getFontName } from './pdf-arabic';

/**
 * Save a generated PDF in a way the user can actually find it:
 * - On the web (preview / browser): trigger a normal browser download via jsPDF.
 * - On native (Android): write to app storage and open the system Share sheet
 *   so the user can save it to Downloads, send via WhatsApp/Email, etc.
 */
async function savePdf(doc: jsPDF, filename: string): Promise<{ saved: boolean; path: string; shared?: boolean }> {
  // Web / preview → browser download
  if (!Capacitor.isNativePlatform()) {
    doc.save(filename);
    return { saved: false, path: filename };
  }

  // Native (Android) → write file then share
  try {
    const base64 = doc.output('datauristring').split(',')[1];
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Share.share({
        title: filename,
        url: written.uri,
        dialogTitle: 'Save or share PDF',
      });
      return { saved: true, path: filename, shared: true };
    } catch {
      // User cancelled share — file still exists in cache
      return { saved: true, path: filename, shared: false };
    }
  } catch {
    // Last-resort fallback
    doc.save(filename);
    return { saved: false, path: filename };
  }
}

type RGB = [number, number, number];

const C: Record<string, RGB> = {
  navy:   [30, 41, 69],
  accent: [96, 165, 250],
  dark:   [30, 30, 30],
  mid:    [100, 100, 100],
  light:  [160, 160, 160],
  muted:  [220, 220, 220],
  white:  [255, 255, 255],
  green:  [34, 197, 94],
  orange: [249, 115, 22],
  red:    [239, 68, 68],
  yellow: [234, 179, 8],
  bg:     [248, 249, 252],
  accentLight: [219, 234, 254],
};

const PRIORITY_COLOR: Record<string, RGB> = {
  low: C.accent, medium: C.yellow, high: C.orange, critical: C.red,
};
const STATUS_COLOR: Record<string, RGB> = {
  draft: C.light, 'in-progress': C.accent, completed: C.green, archived: C.mid,
};

function setFill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function setTxt(doc: jsPDF, c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
function setDrw(doc: jsPDF, c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }

/** Set the correct font based on whether text contains Arabic */
function setFont(doc: jsPDF, style: 'normal' | 'bold', text?: string) {
  const fontName = text && hasArabic(text) ? 'Amiri' : 'helvetica';
  doc.setFont(fontName, style);
}

/** Draw text with automatic RTL alignment for Arabic */
function drawText(
  doc: jsPDF, text: string, x: number, y: number,
  opts?: { align?: string; maxWidth?: number; rtlX?: number }
) {
  if (hasArabic(text)) {
    doc.setFont('Amiri', doc.getFont().fontStyle as 'normal' | 'bold');
    doc.text(text, opts?.rtlX ?? x, y, { align: 'right', maxWidth: opts?.maxWidth });
  } else {
    doc.text(text, x, y, { align: (opts?.align as any) || 'left', maxWidth: opts?.maxWidth });
  }
}

function pill(doc: jsPDF, text: string, x: number, y: number, color: RGB) {
  setFont(doc, 'bold', text);
  const w = doc.getTextWidth(text) + 8;
  setFill(doc, color);
  doc.roundedRect(x, y - 5, w, 7.5, 2, 2, 'F');
  setTxt(doc, C.white);
  doc.setFontSize(7.5); setFont(doc, 'bold', text);
  doc.text(text, x + 4, y);
  return w + 3;
}

function fmtHours(h: number, m?: number): string {
  const hours = Math.floor(h);
  const mins = m ?? Math.round((h - hours) * 60);
  if (hours === 0) return mins + 'm';
  if (mins === 0) return hours + 'h';
  return hours + 'h ' + mins + 'm';
}

function getImageAspect(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 4, h: 3 });
    img.src = dataUrl;
  });
}

export async function exportReportToPdf(report: Report) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 18;
  const CW = PW - M * 2;
  const RX = PW - M; // right edge x for RTL alignment
  let y = M;
  let sectionNum = 0;

  await registerArabicFonts(doc);
  const isRTL = hasArabic(report.title) || hasArabic(report.description);

  // ── Footer ──────────────────────────────────────────────────────────────
  const drawFooter = (pg: number, total: number) => {
    setDrw(doc, C.muted); doc.setLineWidth(0.2);
    doc.line(M, PH - 13, PW - M, PH - 13);
    doc.setFontSize(7.5); setTxt(doc, C.mid); doc.setFont('helvetica', 'normal');
    // Left: app/report label (LTR side)
    const leftLabel = report.title.length > 50 ? report.title.slice(0, 50) + '…' : report.title;
    setFont(doc, 'normal', leftLabel);
    drawText(doc, leftLabel, M, PH - 7, { maxWidth: CW * 0.65, rtlX: RX });
    // Right: page indicator
    doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
    doc.text(`Page ${pg} of ${total}`, isRTL ? M : RX, PH - 7, { align: isRTL ? 'left' : 'right' });
  };

  // ── Page-break helper ───────────────────────────────────────────────────
  const check = (needed: number) => {
    if (y + needed > PH - M - 16) { doc.addPage(); y = M + 4; }
  };

  // ── Numbered section header ─────────────────────────────────────────────
  const section = (title: string) => {
    check(20);
    if (y > M + 4) y += 4; // breathing room above
    sectionNum++;
    const num = String(sectionNum).padStart(2, '0');

    if (isRTL) {
      // Number chip (right)
      setFill(doc, C.navy);
      doc.roundedRect(RX - 11, y, 11, 7, 1.5, 1.5, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(num, RX - 5.5, y + 5, { align: 'center' });
      // Title
      doc.setFontSize(13); setFont(doc, 'bold', title); setTxt(doc, C.navy);
      doc.text(title, RX - 14, y + 5.5, { align: 'right' });
    } else {
      // Number chip (left)
      setFill(doc, C.navy);
      doc.roundedRect(M, y, 11, 7, 1.5, 1.5, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(num, M + 5.5, y + 5, { align: 'center' });
      // Title
      doc.setFontSize(13); setFont(doc, 'bold', title); setTxt(doc, C.navy);
      doc.text(title, M + 14, y + 5.5);
    }
    // Thin full-width underline
    y += 9;
    setDrw(doc, C.muted); doc.setLineWidth(0.3);
    doc.line(M, y, PW - M, y);
    y += 7;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // COVER PAGE  (clean, single-page summary)
  // ═══════════════════════════════════════════════════════════════════════════
  // Top navy band (compact header, rest of page stays white & readable)
  const bandH = 70;
  setFill(doc, C.navy); doc.rect(0, 0, PW, bandH, 'F');
  setFill(doc, C.accent); doc.rect(0, bandH, PW, 1.5, 'F');

  // Category label
  const catLabel = CATEGORY_LABELS[report.category].toUpperCase();
  doc.setFontSize(8.5); setFont(doc, 'bold', catLabel); setTxt(doc, C.accent);
  drawText(doc, catLabel, M, 22, { rtlX: RX });

  // Title
  doc.setFontSize(22); setFont(doc, 'bold', report.title); setTxt(doc, C.white);
  const titleLines: string[] = doc.splitTextToSize(report.title, CW);
  let cy = 34;
  titleLines.slice(0, 2).forEach((l: string) => {
    drawText(doc, l, M, cy, { rtlX: RX });
    cy += 9;
  });

  // Pills row (inside the navy band)
  const pillsY = bandH - 12;
  let cx = isRTL ? RX : M;
  const chips: [string, RGB][] = [
    [PRIORITY_LABELS[report.priority], PRIORITY_COLOR[report.priority]],
    [STATUS_LABELS[report.status], STATUS_COLOR[report.status]],
  ];
  const totalLostTime = (report.lostTimeHours ?? 0) + (report.lostTimeMinutes ?? 0) / 60;
  if (totalLostTime > 0) {
    chips.push([fmtHours(report.lostTimeHours ?? 0, report.lostTimeMinutes) + ' lost', C.orange]);
  }
  doc.setFontSize(7.5);
  if (isRTL) {
    chips.forEach(([label, color]) => {
      setFont(doc, 'bold', label);
      const w = doc.getTextWidth(label) + 8;
      cx -= w;
      setFill(doc, color);
      doc.roundedRect(cx, pillsY - 5, w, 7.5, 2, 2, 'F');
      setTxt(doc, C.white);
      doc.setFontSize(7.5); setFont(doc, 'bold', label);
      doc.text(label, cx + 4, pillsY);
      cx -= 3;
    });
  } else {
    chips.forEach(([label, color]) => { cx += pill(doc, label, cx, pillsY, color); });
  }

  // ─── REPORT SUMMARY CARD (on white) ──────────────────────────────────────
  doc.setFontSize(9); setFont(doc, 'bold'); setTxt(doc, C.navy);
  drawText(doc, isRTL ? 'ملخص التقرير' : 'REPORT SUMMARY', M, bandH + 12, { rtlX: RX });
  setFill(doc, C.accent); doc.rect(isRTL ? RX - 18 : M, bandH + 14, 18, 0.6, 'F');

  const summaryY = bandH + 22;
  const infoRows: [string, string][] = [
    ['Date', format(new Date(report.createdAt), 'MMM d, yyyy')],
    ['Time', format(new Date(report.createdAt), 'HH:mm')],
    ['Category', CATEGORY_LABELS[report.category]],
    ['Priority', PRIORITY_LABELS[report.priority]],
    ['Status', STATUS_LABELS[report.status]],
    ...(report.projectName ? [['Project', report.projectName] as [string, string]] : []),
    ...(report.location ? [['Location', report.location] as [string, string]] : []),
    ...(totalLostTime > 0 ? [['Lost Time', fmtHours(report.lostTimeHours ?? 0, report.lostTimeMinutes)] as [string, string]] : []),
    ...(report.signedBy ? [['Signed by', report.signedBy] as [string, string]] : []),
    ['Attachments', `${report.images.length} ${report.images.length === 1 ? 'photo' : 'photos'}`],
  ];

  // Two-column key/value grid
  const rowH = 9;
  const colW = CW / 2;
  infoRows.forEach((row, i) => {
    const col = i % 2;
    const rowIdx = Math.floor(i / 2);
    const rx = isRTL ? RX - (col === 0 ? 0 : colW) : M + col * colW;
    const ry = summaryY + rowIdx * rowH;
    // Zebra stripe per row
    if (col === 0 && rowIdx % 2 === 0) {
      setFill(doc, C.bg); doc.rect(M, ry - 5, CW, rowH, 'F');
    }
    const [label, value] = row;
    if (isRTL) {
      doc.setFontSize(7); setTxt(doc, C.mid); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), rx - 3, ry, { align: 'right' });
      doc.setFontSize(9.5); setTxt(doc, C.dark); setFont(doc, 'bold', value);
      doc.text(value, rx - 28, ry, { align: 'right', maxWidth: colW - 32 });
    } else {
      doc.setFontSize(7); setTxt(doc, C.mid); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), rx + 3, ry);
      doc.setFontSize(9.5); setTxt(doc, C.dark); setFont(doc, 'bold', value);
      doc.text(value, rx + 28, ry, { maxWidth: colW - 32 });
    }
  });

  // Cover footer
  doc.setFontSize(6.5); setTxt(doc, C.light); doc.setFont('helvetica', 'normal');
  doc.text('ID: ' + report.id, M, PH - 10);
  doc.text('Generated ' + format(new Date(), 'yyyy-MM-dd HH:mm'), PW - M, PH - 10, { align: 'right' });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT PAGES
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage(); y = M + 4;

  // — Description —
  if (report.description) {
    section('Description');
    doc.setFontSize(10); setFont(doc, 'normal', report.description); setTxt(doc, C.dark);
    const lines: string[] = doc.splitTextToSize(report.description, CW);
    lines.forEach((l: string) => {
      check(6);
      drawText(doc, l, M, y, { rtlX: RX });
      y += 5.8;
    });
    y += 4;
  }

  // — Lost Time —
  if (totalLostTime > 0) {
    section('Lost Time');
    check(30);
    setFill(doc, [255, 237, 213]);
    doc.roundedRect(M, y - 2, CW, 24, 3, 3, 'F');
    setDrw(doc, C.orange); doc.roundedRect(M, y - 2, CW, 24, 3, 3, 'D');
    if (isRTL) {
      setFill(doc, C.orange); doc.rect(RX - 4, y - 2, 4, 24, 'F');
      doc.setFontSize(24); doc.setFont('helvetica', 'bold'); setTxt(doc, C.orange);
      doc.text(fmtHours(report.lostTimeHours ?? 0, report.lostTimeMinutes), RX - 10, y + 11, { align: 'right' });
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
      doc.text('Recorded downtime / delay for this incident', RX - 10, y + 18, { align: 'right' });
    } else {
      setFill(doc, C.orange); doc.rect(M, y - 2, 4, 24, 'F');
      doc.setFontSize(24); doc.setFont('helvetica', 'bold'); setTxt(doc, C.orange);
      doc.text(fmtHours(report.lostTimeHours ?? 0, report.lostTimeMinutes), M + 10, y + 11);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
      doc.text('Recorded downtime / delay for this incident', M + 10, y + 18);
    }
    y += 28;
  }

  // — Attachments —
  if (report.images.length > 0) {
    section('Attachments (' + report.images.length + ')');

    const useGrid = report.images.length >= 2;
    const colW = useGrid ? (CW - 4) / 2 : CW;
    const colPositions = useGrid ? [M, M + colW + 4] : [M];

    const aspects = await Promise.all(
      report.images.map(img => getImageAspect(img.annotatedDataUrl || img.dataUrl))
    );

    if (useGrid) {
      let col = 0;
      let rowStartY = y;
      let maxRowH = 0;

      for (let i = 0; i < report.images.length; i++) {
        const img = report.images[i];
        const src = img.annotatedDataUrl || img.dataUrl;
        const aspect = aspects[i];
        const imgH = Math.min((colW * aspect.h) / aspect.w, 70);
        const cellH = imgH + (img.caption ? 12 : 6);

        if (col === 0) { check(cellH + 4); rowStartY = y; maxRowH = 0; }
        const xPos = colPositions[col];

        try {
          doc.addImage(src, 'JPEG', xPos, y, colW, imgH);
          // Thin border for crisp framing
          setDrw(doc, C.muted); doc.setLineWidth(0.2);
          doc.rect(xPos, y, colW, imgH);
          // Photo number badge (top-left)
          setFill(doc, C.navy);
          doc.roundedRect(xPos + 2, y + 2, 7, 5, 1, 1, 'F');
          doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
          doc.text(String(i + 1), xPos + 5.5, y + 5.7, { align: 'center' });
          // Annotated tag (top-right)
          if (img.annotatedDataUrl) {
            setFill(doc, C.accent);
            doc.roundedRect(xPos + colW - 19, y + 2, 17, 5, 1, 1, 'F');
            doc.setFontSize(5.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
            doc.text('ANNOTATED', xPos + colW - 10.5, y + 5.7, { align: 'center' });
          }
        } catch { /* skip */ }

        if (img.caption) {
          doc.setFontSize(7.5); setFont(doc, 'normal', img.caption); setTxt(doc, C.dark);
          const captionLines: string[] = doc.splitTextToSize(img.caption, colW - 2);
          captionLines.slice(0, 2).forEach((cl: string, ci: number) => {
            if (isRTL) {
              doc.text(cl, xPos + colW - 1, y + imgH + 5 + ci * 3.8, { align: 'right' });
            } else {
              doc.text(cl, xPos + 1, y + imgH + 5 + ci * 3.8);
            }
          });
        }

        maxRowH = Math.max(maxRowH, cellH);
        col++;
        if (col >= 2 || i === report.images.length - 1) { y = rowStartY + maxRowH + 5; col = 0; }
      }
    } else {
      for (let i = 0; i < report.images.length; i++) {
        const img = report.images[i];
        const src = img.annotatedDataUrl || img.dataUrl;
        const aspect = aspects[i];
        const imgH = Math.min((CW * aspect.h) / aspect.w, 100);
        check(imgH + 14);
        try {
          doc.addImage(src, 'JPEG', M, y, CW, imgH);
          setDrw(doc, C.muted); doc.setLineWidth(0.2);
          doc.rect(M, y, CW, imgH);
          // Number badge
          setFill(doc, C.navy);
          doc.roundedRect(M + 2, y + 2, 8, 6, 1, 1, 'F');
          doc.setFontSize(7); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
          doc.text(String(i + 1), M + 6, y + 6.2, { align: 'center' });
          if (img.annotatedDataUrl) {
            setFill(doc, C.accent);
            doc.roundedRect(M + CW - 24, y + 2, 22, 6, 1, 1, 'F');
            doc.setFontSize(6); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
            doc.text('ANNOTATED', M + CW - 13, y + 6.2, { align: 'center' });
          }
        } catch { /* skip */ }
        y += imgH + 2;
        if (img.caption) {
          doc.setFontSize(8.5); setFont(doc, 'normal', img.caption); setTxt(doc, C.dark);
          drawText(doc, img.caption, M, y + 4, { maxWidth: CW, rtlX: RX });
        }
        y += img.caption ? 10 : 6;
      }
    }
    y += 2;
  }

  // — Notes —
  if (report.notes) {
    section('Notes');
    setFont(doc, 'normal', report.notes);
    const noteLines: string[] = doc.splitTextToSize(report.notes, CW - 12);
    const boxH = noteLines.length * 5.8 + 12;
    check(boxH + 4);
    setFill(doc, C.bg); doc.roundedRect(M, y - 2, CW, boxH, 3, 3, 'F');
    setDrw(doc, C.muted); doc.setLineWidth(0.2); doc.roundedRect(M, y - 2, CW, boxH, 3, 3, 'D');
    if (isRTL) {
      setFill(doc, C.accent); doc.rect(RX - 3, y - 2, 3, boxH, 'F');
    } else {
      setFill(doc, C.accent); doc.rect(M, y - 2, 3, boxH, 'F');
    }
    doc.setFontSize(10); setFont(doc, 'normal', report.notes); setTxt(doc, C.dark);
    noteLines.forEach((l: string) => {
      drawText(doc, l, M + 8, y + 5, { rtlX: RX - 8 });
      y += 5.8;
    });
    y += 10;
  }

  // — Signature —
  if (report.signatureDataUrl) {
    section('Digital Signature');
    check(48);
    setFill(doc, C.bg); doc.roundedRect(M, y - 2, CW, 42, 3, 3, 'F');
    setDrw(doc, C.muted); doc.setLineWidth(0.2); doc.roundedRect(M, y - 2, CW, 42, 3, 3, 'D');

    const sigX = isRTL ? RX - 76 : M + 8;
    try { doc.addImage(report.signatureDataUrl, 'PNG', sigX, y + 2, 68, 22); } catch { /* skip */ }
    y += 26;
    setDrw(doc, C.mid); doc.line(sigX, y, sigX + 68, y); y += 4;
    if (report.signedBy) {
      doc.setFontSize(10); setFont(doc, 'bold', report.signedBy); setTxt(doc, C.dark);
      drawText(doc, report.signedBy, sigX, y, { rtlX: sigX + 68 });
      y += 5;
    }
    if (report.signedAt) {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
      doc.text('Signed: ' + format(new Date(report.signedAt), 'MMMM d, yyyy  HH:mm'), sigX, y);
    }
    y += 12;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTERS
  // ═══════════════════════════════════════════════════════════════════════════
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i); drawFooter(i, total);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════════
  const filename = 'Report_' + report.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_').slice(0, 30) + '_' + format(new Date(report.createdAt), 'yyyyMMdd') + '.pdf';

  return savePdf(doc, filename);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH EXPORT — multiple reports in one PDF
// ═══════════════════════════════════════════════════════════════════════════════

export async function exportBatchReportsToPdf(reports: Report[]) {
  if (reports.length === 0) throw new Error('No reports to export');
  if (reports.length === 1) return exportReportToPdf(reports[0]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = PW - M * 2;
  const RX = PW - M;

  await registerArabicFonts(doc);

  const isRTL = reports.some(r => hasArabic(r.title) || hasArabic(r.description));

  // ── SHARED COVER PAGE ──
  setFill(doc, C.navy); doc.rect(0, 0, PW, PH, 'F');
  setFill(doc, C.accent); doc.rect(0, 0, PW, 4, 'F');

  // Title
  doc.setFontSize(10); setFont(doc, 'bold'); setTxt(doc, C.accent);
  drawText(doc, 'BATCH REPORT', M, 34, { rtlX: RX });

  if (isRTL) {
    setFill(doc, C.accent); doc.rect(RX - 30, 37, 30, 0.6, 'F');
  } else {
    setFill(doc, C.accent); doc.rect(M, 37, 30, 0.6, 'F');
  }

  doc.setFontSize(28); setFont(doc, 'bold'); setTxt(doc, C.white);
  drawText(doc, `${reports.length} Reports`, M, 55, { rtlX: RX });

  doc.setFontSize(12); setFont(doc, 'normal'); setTxt(doc, C.light);
  drawText(doc, 'Combined Export — ' + format(new Date(), 'MMMM d, yyyy'), M, 68, { rtlX: RX });

  // Summary stats
  const cardY = PH * 0.38;
  setFill(doc, [25, 36, 60]); doc.roundedRect(M, cardY, CW, 70, 3, 3, 'F');

  const cats = new Map<string, number>();
  const pris = new Map<string, number>();
  let totalImages = 0;
  reports.forEach(r => {
    cats.set(r.category, (cats.get(r.category) || 0) + 1);
    pris.set(r.priority, (pris.get(r.priority) || 0) + 1);
    totalImages += r.images.length;
  });

  const summaryRows: [string, string][] = [
    ['Total Reports', String(reports.length)],
    ['Total Images', String(totalImages)],
    ['Categories', Array.from(cats.entries()).map(([k, v]) => `${CATEGORY_LABELS[k as keyof typeof CATEGORY_LABELS]} (${v})`).join(', ')],
    ['Date Range', format(new Date(reports[reports.length - 1].createdAt), 'MMM d, yyyy') + ' — ' + format(new Date(reports[0].createdAt), 'MMM d, yyyy')],
  ];

  summaryRows.forEach(([label, value], i) => {
    const rowY = cardY + 12 + i * 12;
    if (isRTL) {
      doc.setFontSize(7.5); setTxt(doc, C.accent); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), RX - 8, rowY, { align: 'right' });
      doc.setFontSize(9); setTxt(doc, C.white); setFont(doc, 'normal', value);
      doc.text(value, RX - 8, rowY + 5, { align: 'right', maxWidth: CW - 16 });
    } else {
      doc.setFontSize(7.5); setTxt(doc, C.accent); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), M + 8, rowY);
      doc.setFontSize(9); setTxt(doc, C.white); setFont(doc, 'normal', value);
      doc.text(value, M + 8, rowY + 5, { maxWidth: CW - 16 });
    }
  });

  // Footer
  doc.setFontSize(6.5); setTxt(doc, C.light); doc.setFont('helvetica', 'normal');
  doc.text('Generated ' + format(new Date(), 'yyyy-MM-dd HH:mm'), isRTL ? RX : M, PH - 12, { align: isRTL ? 'right' : 'left' });

  // ── MASTER TOC PAGE ──
  doc.addPage();
  const tocPage = doc.getNumberOfPages();
  // We'll fill it after rendering all reports

  // Track where each report starts
  const reportPages: { title: string; page: number; category: string; priority: string }[] = [];

  // ── RENDER EACH REPORT ──
  for (let ri = 0; ri < reports.length; ri++) {
    const report = reports[ri];
    doc.addPage();
    reportPages.push({
      title: report.title,
      page: doc.getNumberOfPages(),
      category: CATEGORY_LABELS[report.category],
      priority: PRIORITY_LABELS[report.priority],
    });

    const rIsRTL = hasArabic(report.title) || hasArabic(report.description);
    let y = M;

    // Mini report header
    setFill(doc, C.navy); doc.rect(0, 0, PW, 28, 'F');
    setFill(doc, C.accent); doc.rect(0, 28, PW, 1, 'F');

    doc.setFontSize(7); setFont(doc, 'bold'); setTxt(doc, C.accent);
    drawText(doc, `REPORT ${ri + 1} OF ${reports.length}`, M, 10, { rtlX: RX });

    doc.setFontSize(14); setFont(doc, 'bold', report.title); setTxt(doc, C.white);
    const titleLines: string[] = doc.splitTextToSize(report.title, CW - 10);
    let ty = 18;
    titleLines.slice(0, 2).forEach((l: string) => {
      drawText(doc, l, M, ty, { rtlX: RX });
      ty += 6;
    });

    // Pills
    y = 34;
    let cx = rIsRTL ? RX : M;
    const chips: [string, RGB][] = [
      [CATEGORY_LABELS[report.category], C.navy],
      [PRIORITY_LABELS[report.priority], PRIORITY_COLOR[report.priority]],
      [STATUS_LABELS[report.status], STATUS_COLOR[report.status]],
    ];
    doc.setFontSize(7);
    if (rIsRTL) {
      chips.forEach(([label, color]) => {
        setFont(doc, 'bold', label);
        const w = doc.getTextWidth(label) + 8;
        cx -= w;
        setFill(doc, color); doc.roundedRect(cx, y - 4, w, 7, 2, 2, 'F');
        setTxt(doc, C.white); doc.setFontSize(7); setFont(doc, 'bold', label);
        doc.text(label, cx + 4, y);
        cx -= 3;
      });
    } else {
      chips.forEach(([label, color]) => { cx += pill(doc, label, cx, y, color); });
    }

    // Meta line
    y = 44;
    doc.setFontSize(8); setFont(doc, 'normal'); setTxt(doc, C.mid);
    const metaParts = [format(new Date(report.createdAt), 'MMM d, yyyy HH:mm')];
    if (report.projectName) metaParts.push(report.projectName);
    if (report.location) metaParts.push(report.location);
    drawText(doc, metaParts.join('  •  '), M, y, { rtlX: RX, maxWidth: CW });
    y += 10;

    const check = (needed: number) => {
      if (y + needed > PH - M - 14) { doc.addPage(); y = M; }
    };

    // Description
    if (report.description) {
      check(12);
      doc.setFontSize(11); setFont(doc, 'bold'); setTxt(doc, C.navy);
      drawText(doc, 'Description', M, y, { rtlX: RX }); y += 6;
      doc.setFontSize(10); setFont(doc, 'normal', report.description); setTxt(doc, C.dark);
      const lines: string[] = doc.splitTextToSize(report.description, CW);
      lines.forEach((l: string) => { check(6); drawText(doc, l, M, y, { rtlX: RX }); y += 5.5; });
      y += 6;
    }

    // Images (simplified 2-col grid)
    if (report.images.length > 0) {
      check(12);
      doc.setFontSize(11); setFont(doc, 'bold'); setTxt(doc, C.navy);
      drawText(doc, `Attachments (${report.images.length})`, M, y, { rtlX: RX }); y += 6;

      const useGrid = report.images.length >= 2;
      const colW = useGrid ? (CW - 4) / 2 : CW;
      const colPos = useGrid ? [M, M + colW + 4] : [M];
      const aspects = await Promise.all(report.images.map(img => getImageAspect(img.annotatedDataUrl || img.dataUrl)));

      if (useGrid) {
        let col = 0, rowStartY = y, maxRowH = 0;
        for (let i = 0; i < report.images.length; i++) {
          const img = report.images[i];
          const src = img.annotatedDataUrl || img.dataUrl;
          const aspect = aspects[i];
          const imgH = Math.min((colW * aspect.h) / aspect.w, 65);
          const cellH = imgH + 4;
          if (col === 0) { check(cellH + 4); rowStartY = y; maxRowH = 0; }
          try { doc.addImage(src, 'JPEG', colPos[col], y, colW, imgH); } catch {}
          if (img.caption) {
            doc.setFontSize(6); setFont(doc, 'normal', img.caption); setTxt(doc, C.mid);
            doc.text(img.caption, colPos[col], y + imgH + 3, { maxWidth: colW });
          }
          maxRowH = Math.max(maxRowH, cellH);
          col++;
          if (col >= 2 || i === report.images.length - 1) { y = rowStartY + maxRowH + 6; col = 0; }
        }
      } else {
        for (let i = 0; i < report.images.length; i++) {
          const img = report.images[i];
          const src = img.annotatedDataUrl || img.dataUrl;
          const aspect = aspects[i];
          const imgH = Math.min((CW * aspect.h) / aspect.w, 90);
          check(imgH + 10);
          try { doc.addImage(src, 'JPEG', M, y, CW, imgH); } catch {}
          y += imgH + 2;
          if (img.caption) {
            doc.setFontSize(8); setFont(doc, 'normal', img.caption); setTxt(doc, C.mid);
            drawText(doc, img.caption, M, y + 2, { maxWidth: CW, rtlX: RX });
            y += 6;
          }
          y += 4;
        }
      }
      y += 4;
    }

    // Notes
    if (report.notes) {
      check(16);
      doc.setFontSize(11); setFont(doc, 'bold'); setTxt(doc, C.navy);
      drawText(doc, 'Notes', M, y, { rtlX: RX }); y += 6;
      setFont(doc, 'normal', report.notes);
      const noteLines: string[] = doc.splitTextToSize(report.notes, CW - 10);
      const boxH = noteLines.length * 5.5 + 10;
      check(boxH + 4);
      setFill(doc, C.bg); doc.roundedRect(M, y - 2, CW, boxH, 3, 3, 'F');
      setDrw(doc, C.muted); doc.roundedRect(M, y - 2, CW, boxH, 3, 3, 'D');
      if (rIsRTL) { setFill(doc, C.accent); doc.rect(RX - 3, y - 2, 3, boxH, 'F'); }
      else { setFill(doc, C.accent); doc.rect(M, y - 2, 3, boxH, 'F'); }
      doc.setFontSize(10); setFont(doc, 'normal', report.notes); setTxt(doc, C.dark);
      noteLines.forEach((l: string) => { drawText(doc, l, M + 8, y + 4, { rtlX: RX - 8 }); y += 5.5; });
      y += 10;
    }

    // Signature
    if (report.signatureDataUrl) {
      check(42);
      doc.setFontSize(11); setFont(doc, 'bold'); setTxt(doc, C.navy);
      drawText(doc, 'Digital Signature', M, y, { rtlX: RX }); y += 6;
      setFill(doc, C.bg); doc.roundedRect(M, y - 2, CW, 36, 3, 3, 'F');
      setDrw(doc, C.muted); doc.roundedRect(M, y - 2, CW, 36, 3, 3, 'D');
      const sigX = rIsRTL ? RX - 76 : M + 8;
      try { doc.addImage(report.signatureDataUrl, 'PNG', sigX, y + 2, 68, 20); } catch {}
      y += 24;
      if (report.signedBy) {
        doc.setFontSize(9); setFont(doc, 'bold', report.signedBy); setTxt(doc, C.dark);
        drawText(doc, report.signedBy, sigX, y, { rtlX: sigX + 68 }); y += 5;
      }
      if (report.signedAt) {
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
        doc.text('Signed: ' + format(new Date(report.signedAt), 'MMM d, yyyy HH:mm'), sigX, y);
      }
    }
  }

  // ── FILL MASTER TOC ──
  doc.setPage(tocPage);
  setFill(doc, C.navy); doc.rect(0, 0, PW, 32, 'F');
  setFill(doc, C.accent); doc.rect(0, 32, PW, 1.2, 'F');
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
  doc.text('Table of Contents', isRTL ? RX : M, 22, { align: isRTL ? 'right' : 'left' });

  let tocY = 48;
  reportPages.forEach((entry, i) => {
    if (i % 2 === 0) { setFill(doc, C.bg); doc.rect(M, tocY - 6, CW, 13, 'F'); }

    if (isRTL) {
      // Number circle
      setFill(doc, C.accent); doc.circle(RX - 5, tocY - 1, 4, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(String(i + 1), RX - 5, tocY + 1, { align: 'center' });

      doc.setFontSize(10); setFont(doc, 'normal', entry.title); setTxt(doc, C.dark);
      const displayTitle = entry.title.length > 40 ? entry.title.slice(0, 40) + '…' : entry.title;
      doc.text(displayTitle, RX - 14, tocY, { align: 'right' });

      // Category tag
      doc.setFontSize(6); setTxt(doc, C.mid); doc.setFont('helvetica', 'normal');
      doc.text(entry.category, RX - 14, tocY + 5, { align: 'right' });

      // Page number
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); setTxt(doc, C.accent);
      doc.text(String(entry.page), M + 2, tocY);
    } else {
      setFill(doc, C.accent); doc.circle(M + 5, tocY - 1, 4, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(String(i + 1), M + 5, tocY + 1, { align: 'center' });

      doc.setFontSize(10); setFont(doc, 'normal', entry.title); setTxt(doc, C.dark);
      const displayTitle = entry.title.length > 40 ? entry.title.slice(0, 40) + '…' : entry.title;
      doc.text(displayTitle, M + 14, tocY);

      // Category tag
      doc.setFontSize(6); setTxt(doc, C.mid); doc.setFont('helvetica', 'normal');
      doc.text(entry.category, M + 14, tocY + 5);

      // Dots + page number
      doc.setFontSize(7); setTxt(doc, C.muted);
      let dx = M + 14 + doc.getTextWidth(displayTitle) + 3;
      const stopX = PW - M - doc.getTextWidth(String(entry.page)) - 6;
      while (dx < stopX) { doc.text('.', dx, tocY); dx += 2.5; }

      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); setTxt(doc, C.accent);
      doc.text(String(entry.page), PW - M - 2, tocY, { align: 'right' });
    }

    tocY += 14;
    // Handle TOC overflow
    if (tocY > PH - 20 && i < reportPages.length - 1) {
      doc.addPage(); tocY = M + 10;
    }
  });

  // ── FOOTERS ──
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    setDrw(doc, C.muted); doc.line(M, PH - 12, PW - M, PH - 12);
    doc.setFontSize(7); setTxt(doc, C.light); doc.setFont('helvetica', 'normal');
    doc.text('Batch Export — ' + reports.length + ' reports', M, PH - 7);
    doc.text('Page ' + i + ' of ' + total, PW - M, PH - 7, { align: 'right' });
  }

  // ── SAVE ──
  const filename = `Batch_Report_${reports.length}_reports_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;

  return savePdf(doc, filename);
}
