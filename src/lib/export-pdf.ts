import jsPDF from 'jspdf';
import { Report, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/types/report';
import { format } from 'date-fns';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { registerArabicFonts, hasArabic, getFontName } from './pdf-arabic';

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
  const M = 16;
  const CW = PW - M * 2;
  const RX = PW - M; // right edge x for RTL alignment
  let y = M;
  const tocEntries: { title: string; page: number; num: string }[] = [];
  let sectionNum = 0;

  // Register Arabic fonts
  registerArabicFonts(doc);

  // Detect if report content is primarily Arabic
  const isRTL = hasArabic(report.title) || hasArabic(report.description);

  const drawFooter = (pg: number, total: number) => {
    setDrw(doc, C.muted); doc.line(M, PH - 12, PW - M, PH - 12);
    doc.setFontSize(7); setTxt(doc, C.light);
    setFont(doc, 'normal', report.title);
    drawText(doc, report.title, M, PH - 7, { maxWidth: CW * 0.6, rtlX: RX });
    doc.setFont('helvetica', 'normal');
    doc.text('Page ' + pg + ' of ' + total, isRTL ? M : RX, PH - 7, { align: isRTL ? 'left' : 'right' });
  };

  const check = (needed: number) => {
    if (y + needed > PH - M - 14) { doc.addPage(); y = M; }
  };

  const section = (title: string) => {
    check(18);
    sectionNum++;
    const num = String(sectionNum);
    tocEntries.push({ title, page: doc.getNumberOfPages(), num });

    if (isRTL) {
      // RTL: circle on right side
      setFill(doc, C.navy);
      doc.circle(RX - 4, y + 4, 4, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(num, RX - 4, y + 5.5, { align: 'center' });

      doc.setFontSize(13); setFont(doc, 'bold', title); setTxt(doc, C.navy);
      doc.text(title, RX - 12, y + 6, { align: 'right' });
      setFill(doc, C.accent); doc.rect(RX - 32, y + 8, 20, 0.8, 'F');
    } else {
      setFill(doc, C.navy);
      doc.circle(M + 4, y + 4, 4, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(num, M + 4, y + 5.5, { align: 'center' });

      doc.setFontSize(13); setFont(doc, 'bold', title); setTxt(doc, C.navy);
      doc.text(title, M + 12, y + 6);
      setFill(doc, C.accent); doc.rect(M + 12, y + 8, 20, 0.8, 'F');
    }
    y += 16;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  setFill(doc, C.navy); doc.rect(0, 0, PW, PH, 'F');
  setFill(doc, C.accent); doc.rect(0, 0, PW, 4, 'F');

  // Category label
  const catLabel = CATEGORY_LABELS[report.category].toUpperCase();
  doc.setFontSize(9); setFont(doc, 'bold', catLabel); setTxt(doc, C.accent);
  drawText(doc, catLabel, M, 34, { rtlX: RX });

  // Decorative line
  if (isRTL) {
    setFill(doc, C.accent); doc.rect(RX - 30, 37, 30, 0.6, 'F');
  } else {
    setFill(doc, C.accent); doc.rect(M, 37, 30, 0.6, 'F');
  }

  // Title
  doc.setFontSize(28); setFont(doc, 'bold', report.title); setTxt(doc, C.white);
  const titleLines: string[] = doc.splitTextToSize(report.title, CW - 10);
  let cy = 52;
  titleLines.forEach((l: string) => {
    drawText(doc, l, M, cy, { rtlX: RX });
    cy += 12;
  });

  // Pills row
  cy += 4;
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
    // Render pills from right to left
    chips.forEach(([label, color]) => {
      setFont(doc, 'bold', label);
      const w = doc.getTextWidth(label) + 8;
      cx -= w;
      setFill(doc, color);
      doc.roundedRect(cx, cy - 5, w, 7.5, 2, 2, 'F');
      setTxt(doc, C.white);
      doc.setFontSize(7.5); setFont(doc, 'bold', label);
      doc.text(label, cx + 4, cy);
      cx -= 3;
    });
  } else {
    chips.forEach(([label, color]) => { cx += pill(doc, label, cx, cy, color); });
  }

  // Horizontal divider
  const divY = PH * 0.52;
  setFill(doc, C.accent); doc.rect(M, divY, CW, 0.5, 'F');

  // Info card
  const cardY = divY + 10;
  setFill(doc, [25, 36, 60]);
  doc.roundedRect(M, cardY, CW, 60, 3, 3, 'F');

  const infoRows: [string, string][] = [
    ['Date', format(new Date(report.createdAt), 'MMMM d, yyyy')],
    ['Time', format(new Date(report.createdAt), 'HH:mm')],
    ...(report.projectName ? [['Project', report.projectName] as [string, string]] : []),
    ...(report.location ? [['Location', report.location] as [string, string]] : []),
    ...(totalLostTime > 0 ? [['Lost Time', fmtHours(report.lostTimeHours ?? 0, report.lostTimeMinutes)] as [string, string]] : []),
    ...(report.signedBy ? [['Signed by', report.signedBy] as [string, string]] : []),
  ];
  
  infoRows.forEach(([label, value], i) => {
    const rowY = cardY + 10 + i * 8;
    if (isRTL) {
      doc.setFontSize(7.5); setTxt(doc, C.accent); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), RX - 8, rowY, { align: 'right' });
      doc.setFontSize(10); setTxt(doc, C.white); setFont(doc, 'normal', value);
      doc.text(value, RX - 38, rowY, { align: 'right' });
    } else {
      doc.setFontSize(7.5); setTxt(doc, C.accent); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), M + 8, rowY);
      doc.setFontSize(10); setTxt(doc, C.white); setFont(doc, 'normal', value);
      doc.text(value, M + 38, rowY);
    }
  });

  // Image count & report ID at bottom
  if (report.images.length > 0) {
    doc.setFontSize(8); setTxt(doc, C.accent);
    doc.text(report.images.length + ' image' + (report.images.length !== 1 ? 's' : '') + ' attached', PW - M, PH - 20, { align: 'right' });
  }
  doc.setFontSize(6.5); setTxt(doc, C.light); doc.setFont('helvetica', 'normal');
  doc.text('ID: ' + report.id, M, PH - 12);
  doc.text('Generated ' + format(new Date(), 'yyyy-MM-dd HH:mm'), PW - M, PH - 12, { align: 'right' });

  // ═══════════════════════════════════════════════════════════════════════════
  // TOC PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();
  const tocPage = doc.getNumberOfPages();

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT PAGES
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage(); y = M;

  // — Description —
  if (report.description) {
    section('Description');
    doc.setFontSize(10); setFont(doc, 'normal', report.description); setTxt(doc, C.dark);
    const lines: string[] = doc.splitTextToSize(report.description, CW);
    lines.forEach((l: string) => {
      check(6);
      drawText(doc, l, M, y, { rtlX: RX });
      y += 5.5;
    });
    y += 8;
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
    y += 30;
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
        const imgH = Math.min((colW * aspect.h) / aspect.w, 65);
        const cellH = imgH + (img.caption ? 10 : 4);

        if (col === 0) { check(cellH + 4); rowStartY = y; maxRowH = 0; }
        const xPos = colPositions[col];

        try {
          doc.addImage(src, 'JPEG', xPos, y, colW, imgH);
          if (img.annotatedDataUrl) {
            setFill(doc, C.accent);
            doc.roundedRect(xPos + 1.5, y + 1.5, 18, 5.5, 1.5, 1.5, 'F');
            doc.setFontSize(5.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
            doc.text('ANNOTATED', xPos + 3, y + 5);
          }
        } catch { /* skip */ }

        if (img.caption) {
          doc.setFontSize(7); setFont(doc, 'normal', img.caption); setTxt(doc, C.mid);
          const captionLines: string[] = doc.splitTextToSize(img.caption, colW - 2);
          captionLines.slice(0, 2).forEach((cl: string, ci: number) => {
            if (isRTL) {
              doc.text(cl, xPos + colW - 1, y + imgH + 4 + ci * 3.5, { align: 'right' });
            } else {
              doc.text(cl, xPos + 1, y + imgH + 4 + ci * 3.5);
            }
          });
        }

        doc.setFontSize(6); setTxt(doc, C.light); doc.setFont('helvetica', 'normal');
        doc.text(String(i + 1), isRTL ? xPos + 1 : xPos + colW - 1, y + imgH + 4, { align: isRTL ? 'left' : 'right' });

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
        check(imgH + 14);
        try {
          doc.addImage(src, 'JPEG', M, y, CW, imgH);
          if (img.annotatedDataUrl) {
            setFill(doc, C.accent);
            doc.roundedRect(M + 2, y + 2, 22, 6, 1.5, 1.5, 'F');
            doc.setFontSize(6); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
            doc.text('ANNOTATED', M + 4, y + 6);
          }
        } catch { /* skip */ }
        y += imgH + 2;
        if (img.caption) {
          doc.setFontSize(8); setFont(doc, 'normal', img.caption); setTxt(doc, C.mid);
          drawText(doc, img.caption, M, y + 4, { maxWidth: CW, rtlX: RX });
        }
        y += img.caption ? 8 : 4;
      }
    }
    y += 4;
  }

  // — Notes —
  if (report.notes) {
    section('Notes');
    setFont(doc, 'normal', report.notes);
    const noteLines: string[] = doc.splitTextToSize(report.notes, CW - 12);
    const boxH = noteLines.length * 5.5 + 12;
    check(boxH + 4);
    setFill(doc, C.bg); doc.roundedRect(M, y - 2, CW, boxH, 3, 3, 'F');
    setDrw(doc, C.muted); doc.roundedRect(M, y - 2, CW, boxH, 3, 3, 'D');
    if (isRTL) {
      setFill(doc, C.accent); doc.rect(RX - 3, y - 2, 3, boxH, 'F');
    } else {
      setFill(doc, C.accent); doc.rect(M, y - 2, 3, boxH, 'F');
    }
    doc.setFontSize(10); setFont(doc, 'normal', report.notes); setTxt(doc, C.dark);
    noteLines.forEach((l: string) => {
      drawText(doc, l, M + 8, y + 5, { rtlX: RX - 8 });
      y += 5.5;
    });
    y += 12;
  }

  // — Signature —
  if (report.signatureDataUrl) {
    section('Digital Signature');
    check(48);
    setFill(doc, C.bg); doc.roundedRect(M, y - 2, CW, 42, 3, 3, 'F');
    setDrw(doc, C.muted); doc.roundedRect(M, y - 2, CW, 42, 3, 3, 'D');

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
  // FILL TABLE OF CONTENTS
  // ═══════════════════════════════════════════════════════════════════════════
  doc.setPage(tocPage);

  setFill(doc, C.navy); doc.rect(0, 0, PW, 32, 'F');
  setFill(doc, C.accent); doc.rect(0, 32, PW, 1.2, 'F');
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
  doc.text('Table of Contents', M, 22);

  let ty = 48;
  tocEntries.forEach((entry, i) => {
    if (i % 2 === 0) { setFill(doc, C.bg); doc.rect(M, ty - 6, CW, 11, 'F'); }

    if (isRTL) {
      // RTL TOC: circle on right, title right-aligned, page number on left
      setFill(doc, C.accent);
      doc.circle(RX - 5, ty - 1, 3.5, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(entry.num, RX - 5, ty + 0.5, { align: 'center' });

      doc.setFontSize(10); setFont(doc, 'normal', entry.title); setTxt(doc, C.dark);
      doc.text(entry.title, RX - 13, ty, { align: 'right' });

      const pageLabel = String(entry.page);
      doc.setFontSize(7); setTxt(doc, C.muted);
      setFont(doc, 'normal', entry.title);
      const titleW = doc.getTextWidth(entry.title);
      let dx = RX - 13 - titleW - 3;
      const stopX = M + doc.getTextWidth(pageLabel) + 6;
      while (dx > stopX) { doc.text('.', dx, ty); dx -= 2.5; }

      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); setTxt(doc, C.accent);
      doc.text(pageLabel, M + 2, ty);
    } else {
      setFill(doc, C.accent);
      doc.circle(M + 5, ty - 1, 3.5, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(entry.num, M + 5, ty + 0.5, { align: 'center' });

      doc.setFontSize(10); setFont(doc, 'normal', entry.title); setTxt(doc, C.dark);
      doc.text(entry.title, M + 13, ty);

      const pageLabel = String(entry.page);
      doc.setFontSize(7); setTxt(doc, C.muted);
      let dx = M + 13 + doc.getTextWidth(entry.title) + 3;
      const stopX = PW - M - doc.getTextWidth(pageLabel) - 6;
      while (dx < stopX) { doc.text('.', dx, ty); dx += 2.5; }

      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); setTxt(doc, C.accent);
      doc.text(pageLabel, PW - M - 2, ty, { align: 'right' });
    }

    ty += 12;
  });

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

  try {
    const base64 = doc.output('datauristring').split(',')[1];
    await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Data, recursive: true });
    return { saved: true, path: filename };
  } catch {
    doc.save(filename);
    return { saved: false, path: filename };
  }
}
