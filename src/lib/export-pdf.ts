import jsPDF from 'jspdf';
import { Report, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/types/report';
import { format } from 'date-fns';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { registerArabicFonts, hasArabic, getFontName } from './pdf-arabic';

// ─── Platform save helper ─────────────────────────────────────────────────────
export async function savePdf(
  doc: jsPDF,
  filename: string,
): Promise<{ saved: boolean; path: string; shared?: boolean }> {
  if (!Capacitor.isNativePlatform()) {
    doc.save(filename);
    return { saved: false, path: filename };
  }
  try {
    const base64 = doc.output('datauristring').split(',')[1];
    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Share.share({ title: filename, url: written.uri, dialogTitle: 'Save or share PDF' });
      return { saved: true, path: filename, shared: true };
    } catch {
      return { saved: true, path: filename, shared: false };
    }
  } catch {
    doc.save(filename);
    return { saved: false, path: filename };
  }
}

// ─── Design tokens ────────────────────────────────────────────────────────────
export type RGB = [number, number, number];

export const C: Record<string, RGB> = {
  // Brand
  navy:        [18,  32,  62],
  navyMid:     [28,  46,  86],
  accent:      [79,  142, 247],
  accentDark:  [52,  105, 210],
  accentLight: [214, 230, 255],
  // Neutrals
  dark:        [22,  22,  30],
  charcoal:    [55,  55,  70],
  mid:         [110, 110, 128],
  light:       [165, 165, 178],
  muted:       [210, 212, 220],
  subtle:      [240, 241, 246],
  white:       [255, 255, 255],
  // Status
  green:       [22,  185, 100],
  greenLight:  [210, 247, 228],
  orange:      [245, 108, 18],
  orangeLight: [255, 235, 215],
  red:         [232, 55,  55],
  redLight:    [255, 222, 222],
  yellow:      [226, 172,  0],
  yellowLight: [255, 245, 200],
  // Page
  bg:          [247, 248, 252],
  pageDark:    [12,  14,  22],   // for photo spread pages
};

export const PRIORITY_COLOR: Record<string, RGB> = {
  low:      C.accent,
  medium:   C.yellow,
  high:     C.orange,
  critical: C.red,
};
export const STATUS_COLOR: Record<string, RGB> = {
  draft:        C.light,
  'in-progress':C.accent,
  completed:    C.green,
  archived:     C.mid,
};

// ─── Drawing primitives ───────────────────────────────────────────────────────
export const setFill = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
export const setTxt  = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
export const setDrw  = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

export function setFont(doc: jsPDF, style: 'normal' | 'bold', text?: string) {
  const fontName = text && hasArabic(text) ? 'Amiri' : 'helvetica';
  doc.setFont(fontName, style);
}

export function drawText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  opts?: { align?: string; maxWidth?: number; rtlX?: number },
) {
  if (hasArabic(text)) {
    doc.setFont('Amiri', doc.getFont().fontStyle as 'normal' | 'bold');
    doc.text(text, opts?.rtlX ?? x, y, { align: 'right', maxWidth: opts?.maxWidth });
  } else {
    doc.text(text, x, y, { align: (opts?.align as any) || 'left', maxWidth: opts?.maxWidth });
  }
}

/** Rounded pill badge — returns width consumed (including gap). */
export function pill(doc: jsPDF, text: string, x: number, y: number, color: RGB, textColor: RGB = C.white): number {
  setFont(doc, 'bold', text);
  const tw = doc.getTextWidth(text);
  const pw = tw + 10;
  const ph = 8;
  setFill(doc, color);
  doc.roundedRect(x, y - ph + 1, pw, ph, 2, 2, 'F');
  setTxt(doc, textColor);
  doc.setFontSize(7.5);
  setFont(doc, 'bold', text);
  doc.text(text, x + 5, y - 0.5);
  return pw + 4;
}

export function fmtHours(h: number, m?: number): string {
  const hours = Math.floor(h);
  const mins  = m ?? Math.round((h - hours) * 60);
  if (hours === 0) return `${mins}m`;
  if (mins  === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getImageAspect(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 4, h: 3 });
    img.src = dataUrl;
  });
}

/**
 * Load an Image element from a data URL.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Re-encode a data URL through a canvas at high JPEG quality (0.95).
 * Preserves full resolution; avoids jsPDF's default medium-quality recompression.
 */
async function toHighQualityJpeg(src: string): Promise<string> {
  try {
    const img    = await loadImage(src);
    const canvas = document.createElement('canvas');
    canvas.width  = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.95);
  } catch {
    return src; // fallback to original
  }
}

/**
 * Add an image to the doc at the given position/size with best quality.
 * Chooses PNG for transparency; JPEG (re-encoded at 0.95) otherwise.
 */
async function addImage(
  doc: jsPDF,
  src: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<void> {
  try {
    const fmt  = src.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    const data = fmt === 'JPEG' ? await toHighQualityJpeg(src) : src;
    doc.addImage(data, fmt, x, y, w, h, undefined, 'SLOW');
  } catch {
    // silently skip broken images
  }
}

// ─── Single-report export ─────────────────────────────────────────────────────
export interface PdfExportOptions {
  /** IDs of images to include. Omitted = all images. */
  selectedImageIds?: string[];
  /** Extra rich-text notes appended to the Notes section. Supports **bold** markers. */
  extraNotes?: string;
  includeDescription?: boolean;
  includeLostTime?: boolean;
  includePhotos?: boolean;
  includeNotes?: boolean;
  includeSignature?: boolean;
}

export async function exportReportToPdf(
  _report: Report,
  options?: PdfExportOptions,
): Promise<{ saved: boolean; path: string; shared?: boolean }> {
  const opts = {
    includeDescription: true,
    includeLostTime:    true,
    includePhotos:      true,
    includeNotes:       true,
    includeSignature:   true,
    ...options,
  };
  const filteredImages = opts.selectedImageIds
    ? _report.images.filter(i => opts.selectedImageIds!.includes(i.id))
    : _report.images;
  const extra = (opts.extraNotes ?? '').trim();
  const mergedNotes = [_report.notes, extra].filter(Boolean).join('\n\n');
  const report: Report = { ..._report, images: filteredImages, notes: mergedNotes };

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await registerArabicFonts(doc);

  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M  = 18;
  const CW = PW - M * 2;
  const RX = PW - M;

  const isRTL = hasArabic(report.title) || hasArabic(report.description);
  let y = M;
  let sectionNum = 0;

  // ── Decorative page background ─────────────────────────────────────────────
  const drawPageBg = () => {
    setFill(doc, C.white); doc.rect(0, 0, PW, PH, 'F');
    setFill(doc, C.subtle); doc.rect(0, 0, 5, PH, 'F');
  };

  // ── Footer ─────────────────────────────────────────────────────────────────
  const drawFooter = (pg: number, total: number) => {
    setFill(doc, C.subtle); doc.rect(0, PH - 14, PW, 14, 'F');
    setFill(doc, C.accent); doc.rect(0, PH - 14, PW, 0.6, 'F');
    doc.setFontSize(7); setTxt(doc, C.mid); doc.setFont('helvetica', 'normal');
    const label = report.title.length > 52 ? report.title.slice(0, 52) + '…' : report.title;
    setFont(doc, 'normal', label);
    drawText(doc, label, M, PH - 5.5, { maxWidth: CW * 0.65, rtlX: RX });
    doc.setFont('helvetica', 'bold'); setTxt(doc, C.accent);
    doc.setFontSize(8);
    doc.text(`${pg} / ${total}`, isRTL ? M + 2 : RX, PH - 5.5, {
      align: isRTL ? 'left' : 'right',
    });
  };

  // ── Page-break guard ───────────────────────────────────────────────────────
  const check = (needed: number) => {
    if (y + needed > PH - M - 18) {
      doc.addPage();
      drawPageBg();
      y = M + 4;
    }
  };

  // ── Section header ─────────────────────────────────────────────────────────
  const section = (title: string) => {
    check(22);
    if (y > M + 4) y += 6;
    sectionNum++;
    const num = String(sectionNum).padStart(2, '0');

    if (isRTL) {
      setFill(doc, C.accent);
      doc.roundedRect(RX - 12, y, 12, 7.5, 2, 2, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(num, RX - 6, y + 5.4, { align: 'center' });
      doc.setFontSize(13.5); setFont(doc, 'bold', title); setTxt(doc, C.navy);
      doc.text(title, RX - 16, y + 5.5, { align: 'right' });
    } else {
      setFill(doc, C.accent);
      doc.roundedRect(M, y, 12, 7.5, 2, 2, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(num, M + 6, y + 5.4, { align: 'center' });
      doc.setFontSize(13.5); setFont(doc, 'bold', title); setTxt(doc, C.navy);
      doc.text(title, M + 16, y + 5.5);
    }
    y += 10;
    setDrw(doc, C.muted); doc.setLineWidth(0.25);
    doc.line(M, y, PW - M, y);
    y += 7;
  };

  // ── Key-value renderer ─────────────────────────────────────────────────────
  const kv = (label: string, value: string, rowY: number, colX: number, colW: number) => {
    if (isRTL) {
      doc.setFontSize(6.5); setTxt(doc, C.mid); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), colX - 2, rowY, { align: 'right' });
      doc.setFontSize(9.5); setTxt(doc, C.dark); setFont(doc, 'bold', value);
      doc.text(value, colX - 24, rowY, { align: 'right', maxWidth: colW - 28 });
    } else {
      doc.setFontSize(6.5); setTxt(doc, C.mid); doc.setFont('helvetica', 'normal');
      doc.text(label.toUpperCase(), colX + 3, rowY);
      doc.setFontSize(9.5); setTxt(doc, C.dark); setFont(doc, 'bold', value);
      doc.text(value, colX + 24, rowY, { maxWidth: colW - 28 });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ═══════════════════════════════════════════════════════════════════════════
  const BAND = 76;
  setFill(doc, C.navy);    doc.rect(0, 0, PW, BAND,   'F');
  setFill(doc, C.navyMid); doc.rect(0, 0, PW, BAND/2, 'F');
  setFill(doc, C.accent);  doc.rect(0, BAND, PW, 1.8, 'F');
  // Decorative arc (top-right corner)
  setFill(doc, C.accentDark);
  doc.circle(PW + 10, -10, 55, 'F');

  // Category label
  const catLabel = CATEGORY_LABELS[report.category].toUpperCase();
  doc.setFontSize(8.5); setFont(doc, 'bold', catLabel); setTxt(doc, C.accentLight);
  drawText(doc, catLabel, M, 20, { rtlX: RX });
  setFill(doc, C.accent);
  if (isRTL) doc.rect(RX - 24, 23, 24, 0.8, 'F');
  else        doc.rect(M,       23, 24, 0.8, 'F');

  // Title
  doc.setFontSize(23); setFont(doc, 'bold', report.title); setTxt(doc, C.white);
  const titleLines: string[] = doc.splitTextToSize(report.title, CW - 8);
  let cy = 35;
  titleLines.slice(0, 2).forEach((l: string) => {
    drawText(doc, l, M, cy, { rtlX: RX });
    cy += 9.5;
  });

  // Pills row inside the band
  const pillsY = BAND - 10;
  doc.setFontSize(7.5);
  let cx = isRTL ? RX : M;
  const chips: [string, RGB][] = [
    [PRIORITY_LABELS[report.priority], PRIORITY_COLOR[report.priority]],
    [STATUS_LABELS[report.status],     STATUS_COLOR[report.status]],
  ];
  const totalLostTime = (report.lostTimeHours ?? 0) + (report.lostTimeMinutes ?? 0) / 60;
  if (totalLostTime > 0) {
    chips.push([fmtHours(report.lostTimeHours ?? 0, report.lostTimeMinutes) + ' lost', C.orange]);
  }
  if (isRTL) {
    chips.forEach(([label, color]) => {
      setFont(doc, 'bold', label);
      const w = doc.getTextWidth(label) + 10;
      cx -= w;
      setFill(doc, color); doc.roundedRect(cx, pillsY - 6, w, 8, 2, 2, 'F');
      setTxt(doc, C.white); doc.setFontSize(7.5); setFont(doc, 'bold', label);
      doc.text(label, cx + 5, pillsY);
      cx -= 4;
    });
  } else {
    chips.forEach(([label, color]) => { cx += pill(doc, label, cx, pillsY, color); });
  }

  // ── Summary card ───────────────────────────────────────────────────────────
  const CARD_Y = BAND + 12;
  doc.setFontSize(8); setFont(doc, 'bold'); setTxt(doc, C.navy);
  drawText(doc, isRTL ? 'ملخص التقرير' : 'REPORT SUMMARY', M, CARD_Y, { rtlX: RX });
  setFill(doc, C.accent);
  if (isRTL) doc.rect(RX - 22, CARD_Y + 2, 22, 0.7, 'F');
  else        doc.rect(M,       CARD_Y + 2, 22, 0.7, 'F');

  const infoRows: [string, string][] = [
    ['Date',      format(new Date(report.createdAt), 'MMM d, yyyy')],
    ['Time',      format(new Date(report.createdAt), 'HH:mm')],
    ['Category',  CATEGORY_LABELS[report.category]],
    ['Priority',  PRIORITY_LABELS[report.priority]],
    ['Status',    STATUS_LABELS[report.status]],
    ...(report.projectName ? [['Project',   report.projectName] as [string, string]] : []),
    ...(report.location    ? [['Location',  report.location]    as [string, string]] : []),
    ...(totalLostTime > 0  ? [['Lost Time', fmtHours(report.lostTimeHours ?? 0, report.lostTimeMinutes)] as [string, string]] : []),
    ...(report.signedBy    ? [['Signed By', report.signedBy]    as [string, string]] : []),
    ['Photos',    `${report.images.length} attached`],
  ];

  const ROW_H  = 9.5;
  const COL_W  = CW / 2;
  const INFO_Y = CARD_Y + 12;

  infoRows.forEach((row, i) => {
    const col    = i % 2;
    const rowIdx = Math.floor(i / 2);
    const ry     = INFO_Y + rowIdx * ROW_H;
    if (col === 0 && rowIdx % 2 === 0) {
      setFill(doc, C.subtle); doc.rect(M, ry - 5.5, CW, ROW_H, 'F');
    }
    const colX = isRTL ? RX - col * COL_W : M + col * COL_W;
    kv(row[0], row[1], ry, colX, COL_W);
  });

  const BOTTOM = INFO_Y + Math.ceil(infoRows.length / 2) * ROW_H + 6;
  setDrw(doc, C.muted); doc.setLineWidth(0.2);
  doc.line(M, BOTTOM, PW - M, BOTTOM);

  // Cover footer
  doc.setFontSize(6.5); setTxt(doc, C.light); doc.setFont('helvetica', 'normal');
  doc.text('ID: ' + report.id,                                      M,      PH - 8);
  doc.text('Generated ' + format(new Date(), 'yyyy-MM-dd  HH:mm'), PW - M, PH - 8, { align: 'right' });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTENT PAGES
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage(); drawPageBg(); y = M + 4;

  // — Description ─────────────────────────────────────────────────────────────
  if (report.description) {
    section('Description');
    doc.setFontSize(10.5); setFont(doc, 'normal', report.description); setTxt(doc, C.charcoal);
    const lines: string[] = doc.splitTextToSize(report.description, CW);
    lines.forEach((l: string) => { check(6); drawText(doc, l, M, y, { rtlX: RX }); y += 6; });
    y += 5;
  }

  // — Lost Time ───────────────────────────────────────────────────────────────
  if (totalLostTime > 0) {
    section('Lost Time');
    check(32);
    const BOX_H = 26;
    setFill(doc, C.orangeLight); doc.roundedRect(M, y - 2, CW, BOX_H, 3, 3, 'F');
    setFill(doc, C.orange);
    if (isRTL) doc.roundedRect(RX - 5, y - 2, 5, BOX_H, 3, 3, 'F');
    else        doc.roundedRect(M,      y - 2, 5, BOX_H, 3, 3, 'F');
    setDrw(doc, C.orange); doc.setLineWidth(0.3);
    doc.roundedRect(M, y - 2, CW, BOX_H, 3, 3, 'D');
    const tX = isRTL ? RX - 12 : M + 12;
    doc.setFontSize(26); doc.setFont('helvetica', 'bold'); setTxt(doc, C.orange);
    drawText(doc, fmtHours(report.lostTimeHours ?? 0, report.lostTimeMinutes), tX, y + 12, { rtlX: tX });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
    drawText(doc, 'Recorded downtime / delay for this incident', tX, y + 19, { rtlX: tX });
    y += BOX_H + 6;
  }

  // — Photo Attachments ───────────────────────────────────────────────────────
  if (report.images.length > 0) {
    section(`Attachments  (${report.images.length})`);

    const aspects = await Promise.all(
      report.images.map(img => getImageAspect(img.annotatedDataUrl || img.dataUrl)),
    );

    const useGrid = report.images.length >= 2;

    if (useGrid) {
      // 2-column thumbnail grid
      const GCOL   = (CW - 5) / 2;
      const colPos = [M, M + GCOL + 5];
      let col = 0, rowStartY = y, maxRowH = 0;

      for (let i = 0; i < report.images.length; i++) {
        const img    = report.images[i];
        const src    = img.annotatedDataUrl || img.dataUrl;
        const aspect = aspects[i];
        const imgH   = Math.min((GCOL * aspect.h) / aspect.w, 72);
        const cellH  = imgH + (img.caption ? 14 : 6);

        if (col === 0) { check(cellH + 6); rowStartY = y; maxRowH = 0; }
        const xPos = colPos[col];

        // Drop shadow
        setFill(doc, C.muted); doc.roundedRect(xPos + 1.2, y + 1.2, GCOL, imgH, 2, 2, 'F');
        await addImage(doc, src, xPos, y, GCOL, imgH);
        setDrw(doc, C.muted); doc.setLineWidth(0.2);
        doc.roundedRect(xPos, y, GCOL, imgH, 2, 2, 'D');

        // Photo number badge
        setFill(doc, C.navy); doc.roundedRect(xPos + 2.5, y + 2.5, 7.5, 5.5, 1.2, 1.2, 'F');
        doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
        doc.text(String(i + 1), xPos + 6.25, y + 6.2, { align: 'center' });

        // Annotated tag
        if (img.annotatedDataUrl) {
          setFill(doc, C.accentDark);
          doc.roundedRect(xPos + GCOL - 21, y + 2.5, 18.5, 5.5, 1.2, 1.2, 'F');
          doc.setFontSize(5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
          doc.text('ANNOTATED', xPos + GCOL - 12.25, y + 6.2, { align: 'center' });
        }

        if (img.caption) {
          doc.setFontSize(7.5); setFont(doc, 'normal', img.caption); setTxt(doc, C.charcoal);
          const capLines: string[] = doc.splitTextToSize(img.caption, GCOL);
          capLines.slice(0, 2).forEach((cl: string, ci: number) => {
            if (isRTL) doc.text(cl, xPos + GCOL - 1, y + imgH + 5 + ci * 4, { align: 'right' });
            else        doc.text(cl, xPos + 1,        y + imgH + 5 + ci * 4);
          });
        }

        maxRowH = Math.max(maxRowH, cellH);
        col++;
        if (col >= 2 || i === report.images.length - 1) { y = rowStartY + maxRowH + 6; col = 0; }
      }
    } else {
      // Single image — full content width
      const img    = report.images[0];
      const src    = img.annotatedDataUrl || img.dataUrl;
      const aspect = aspects[0];
      const imgH   = Math.min((CW * aspect.h) / aspect.w, 110);
      check(imgH + 14);
      setFill(doc, C.muted); doc.roundedRect(M + 1.5, y + 1.5, CW, imgH, 2, 2, 'F');
      await addImage(doc, src, M, y, CW, imgH);
      setDrw(doc, C.muted); doc.setLineWidth(0.2); doc.roundedRect(M, y, CW, imgH, 2, 2, 'D');
      setFill(doc, C.navy); doc.roundedRect(M + 3, y + 3, 9, 6.5, 1.5, 1.5, 'F');
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text('1', M + 7.5, y + 7.5, { align: 'center' });
      if (img.annotatedDataUrl) {
        setFill(doc, C.accentDark); doc.roundedRect(M + CW - 26, y + 3, 23, 6.5, 1.5, 1.5, 'F');
        doc.setFontSize(5.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
        doc.text('ANNOTATED', M + CW - 14.5, y + 7.5, { align: 'center' });
      }
      y += imgH + 3;
      if (img.caption) {
        doc.setFontSize(9); setFont(doc, 'normal', img.caption); setTxt(doc, C.charcoal);
        drawText(doc, img.caption, M, y + 5, { maxWidth: CW, rtlX: RX });
        y += 10;
      }
      y += 4;
    }

    // ── FULL-QUALITY PHOTO GALLERY PAGES ─────────────────────────────────────
    // Each photo gets a dedicated dark page maximising its rendered size,
    // re-encoded at 0.95 JPEG quality for the sharpest possible output.
    for (let i = 0; i < report.images.length; i++) {
      const img  = report.images[i];
      const src  = img.annotatedDataUrl || img.dataUrl;
      const { w: iW, h: iH } = await getImageAspect(src);

      doc.addPage();

      // Dark background
      setFill(doc, C.pageDark); doc.rect(0, 0, PW, PH, 'F');
      // Thin accent top strip
      setFill(doc, C.accent);  doc.rect(0, 0, PW, 1.2, 'F');

      // Calculate maximum image size centred in the content area
      const PAD      = 10;
      const INFO_BAR = 20;
      const maxW     = PW - PAD * 2;
      const maxH     = PH - PAD - INFO_BAR - 2;

      let imgW = maxW;
      let imgH = (imgW * iH) / iW;
      if (imgH > maxH) { imgH = maxH; imgW = (imgH * iW) / iH; }

      const imgX = (PW - imgW) / 2;
      const imgY = PAD;

      await addImage(doc, src, imgX, imgY, imgW, imgH);

      // Subtle vignette border
      setDrw(doc, [50, 55, 80]); doc.setLineWidth(0.3);
      doc.rect(imgX, imgY, imgW, imgH);

      // Bottom info bar
      const barY = PH - INFO_BAR;
      setFill(doc, [18, 22, 40]); doc.rect(0, barY, PW, INFO_BAR, 'F');
      setFill(doc, C.accent);     doc.rect(0, barY, PW, 0.6, 'F');

      // Photo counter chip
      setFill(doc, C.accent);
      doc.roundedRect(M, barY + 6, 28, 7.5, 2, 2, 'F');
      doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(`Photo ${i + 1} of ${report.images.length}`, M + 14, barY + 11.2, { align: 'center' });

      // Annotated chip
      if (img.annotatedDataUrl) {
        setFill(doc, C.accentDark);
        doc.roundedRect(M + 32, barY + 6, 20, 7.5, 2, 2, 'F');
        doc.setFontSize(6); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
        doc.text('ANNOTATED', M + 42, barY + 11.2, { align: 'center' });
      }

      // Caption
      if (img.caption) {
        doc.setFontSize(8.5); setFont(doc, 'normal', img.caption); setTxt(doc, C.light);
        const maxCaptionW = CW - 60;
        const capLines: string[] = doc.splitTextToSize(img.caption, maxCaptionW);
        drawText(doc, capLines[0], isRTL ? RX : M + 56, barY + 10.5, {
          maxWidth: maxCaptionW, rtlX: isRTL ? M + 56 : undefined,
        });
      }

      // Report title (far right, dimmed)
      const shortTitle = report.title.length > 36 ? report.title.slice(0, 36) + '…' : report.title;
      doc.setFontSize(7); setFont(doc, 'normal', shortTitle); setTxt(doc, [80, 85, 110] as RGB);
      drawText(doc, shortTitle, isRTL ? M : RX, barY + 11.5, {
        align: isRTL ? 'left' : 'right', rtlX: M,
      });
    }

    // New content page after gallery
    doc.addPage(); drawPageBg(); y = M + 4;
    sectionNum--; // offset — next section() will re-increment
  }

  // — Notes ──────────────────────────────────────────────────────────────────
  if (report.notes) {
    section('Notes');
    setFont(doc, 'normal', report.notes);
    const noteLines: string[] = doc.splitTextToSize(report.notes, CW - 14);
    const BOX_H = noteLines.length * 6 + 14;
    check(BOX_H + 4);
    setFill(doc, C.subtle); doc.roundedRect(M, y - 2, CW, BOX_H, 3, 3, 'F');
    setFill(doc, C.accent);
    if (isRTL) doc.rect(RX - 4, y - 2, 4, BOX_H, 'F');
    else        doc.rect(M,      y - 2, 4, BOX_H, 'F');
    setDrw(doc, C.muted); doc.setLineWidth(0.2);
    doc.roundedRect(M, y - 2, CW, BOX_H, 3, 3, 'D');
    doc.setFontSize(10.5); setFont(doc, 'normal', report.notes); setTxt(doc, C.charcoal);
    noteLines.forEach((l: string) => {
      drawText(doc, l, M + 10, y + 5, { rtlX: RX - 10 });
      y += 6;
    });
    y += 12;
  }

  // — Digital Signature ───────────────────────────────────────────────────────
  if (report.signatureDataUrl) {
    section('Digital Signature');
    check(52);
    const SIG_H = 46;
    setFill(doc, C.subtle); doc.roundedRect(M, y - 2, CW, SIG_H, 3, 3, 'F');
    setDrw(doc, C.muted); doc.setLineWidth(0.2); doc.roundedRect(M, y - 2, CW, SIG_H, 3, 3, 'D');
    const sigX = isRTL ? RX - 80 : M + 10;
    await addImage(doc, report.signatureDataUrl, sigX, y + 4, 70, 24);
    y += 30;
    setDrw(doc, C.mid); doc.setLineWidth(0.3); doc.line(sigX, y, sigX + 70, y); y += 5;
    if (report.signedBy) {
      doc.setFontSize(10.5); setFont(doc, 'bold', report.signedBy); setTxt(doc, C.dark);
      drawText(doc, report.signedBy, sigX, y, { rtlX: sigX + 70 }); y += 5.5;
    }
    if (report.signedAt) {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
      doc.text('Signed: ' + format(new Date(report.signedAt), 'MMMM d, yyyy  ·  HH:mm'), sigX, y);
    }
  }

  // ── Footers ─────────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i); drawFooter(i, total);
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  const safeName = report.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_').slice(0, 30);
  const filename  = `Report_${safeName}_${format(new Date(report.createdAt), 'yyyyMMdd')}.pdf`;
  return savePdf(doc, filename);
}

// ─── Batch export ─────────────────────────────────────────────────────────────
export async function exportBatchReportsToPdf(
  reports: Report[],
): Promise<{ saved: boolean; path: string; shared?: boolean }> {
  if (reports.length === 0) throw new Error('No reports to export');
  if (reports.length === 1) return exportReportToPdf(reports[0]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await registerArabicFonts(doc);

  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M  = 16;
  const CW = PW - M * 2;
  const RX = PW - M;

  const isRTL = reports.some(r => hasArabic(r.title) || hasArabic(r.description));

  // ── Shared cover ────────────────────────────────────────────────────────────
  setFill(doc, C.navy);    doc.rect(0, 0, PW, PH,     'F');
  setFill(doc, C.navyMid); doc.rect(0, 0, PW, PH / 2, 'F');
  setFill(doc, C.accent);  doc.rect(0, 0, PW, 4,      'F');
  setFill(doc, C.accentDark);
  doc.triangle(PW, 0, PW, PH * 0.55, PW * 0.45, 0, 'F');

  doc.setFontSize(10); setFont(doc, 'bold'); setTxt(doc, C.accentLight);
  drawText(doc, 'BATCH EXPORT', M, 30, { rtlX: RX });
  setFill(doc, C.accent);
  if (isRTL) doc.rect(RX - 28, 33, 28, 0.8, 'F');
  else        doc.rect(M,       33, 28, 0.8, 'F');

  doc.setFontSize(30); setFont(doc, 'bold'); setTxt(doc, C.white);
  drawText(doc, `${reports.length} Reports`, M, 52, { rtlX: RX });
  doc.setFontSize(12); setFont(doc, 'normal'); setTxt(doc, C.light);
  drawText(doc, format(new Date(), 'MMMM d, yyyy'), M, 65, { rtlX: RX });

  // Stats card
  const CARD_Y = PH * 0.40;
  setFill(doc, [20, 30, 58] as RGB); doc.roundedRect(M, CARD_Y, CW, 76, 3, 3, 'F');
  setFill(doc, C.accent); doc.rect(M, CARD_Y, 4, 76, 'F');
  setDrw(doc, C.accentDark); doc.setLineWidth(0.4);
  doc.roundedRect(M, CARD_Y, CW, 76, 3, 3, 'D');

  let totalImages = 0;
  const cats = new Map<string, number>();
  reports.forEach(r => {
    cats.set(r.category, (cats.get(r.category) || 0) + 1);
    totalImages += r.images.length;
  });

  const summaryRows: [string, string][] = [
    ['Total Reports', String(reports.length)],
    ['Total Photos',  String(totalImages)],
    ['Categories',    Array.from(cats.entries())
      .map(([k, v]) => `${CATEGORY_LABELS[k as keyof typeof CATEGORY_LABELS]} (${v})`).join(', ')],
    ['Date Range',    `${format(new Date(reports[reports.length - 1].createdAt), 'MMM d, yyyy')}` +
      ` — ${format(new Date(reports[0].createdAt), 'MMM d, yyyy')}`],
  ];

  summaryRows.forEach(([label, value], i) => {
    const rowY  = CARD_Y + 14 + i * 15;
    const lx    = isRTL ? RX - 8 : M + 10;
    const align = isRTL ? 'right' : 'left';
    doc.setFontSize(7.5); setTxt(doc, C.accentLight); doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), lx, rowY, { align });
    doc.setFontSize(10); setTxt(doc, C.white); setFont(doc, 'normal', value);
    doc.text(value, lx, rowY + 6.5, { align, maxWidth: CW - 18 });
  });

  doc.setFontSize(6.5); setTxt(doc, C.light); doc.setFont('helvetica', 'normal');
  drawText(doc, 'Generated ' + format(new Date(), 'yyyy-MM-dd  HH:mm'), M, PH - 8, { rtlX: RX });

  // ── TOC placeholder ─────────────────────────────────────────────────────────
  doc.addPage();
  const tocPageNum = doc.getNumberOfPages();
  const reportPages: { title: string; page: number; category: string; priority: string }[] = [];

  // ── Render each report ──────────────────────────────────────────────────────
  for (let ri = 0; ri < reports.length; ri++) {
    const report  = reports[ri];
    doc.addPage();
    reportPages.push({
      title:    report.title,
      page:     doc.getNumberOfPages(),
      category: CATEGORY_LABELS[report.category],
      priority: PRIORITY_LABELS[report.priority],
    });

    const rIsRTL = hasArabic(report.title) || hasArabic(report.description);
    let y = M;

    setFill(doc, C.white);  doc.rect(0, 0, PW, PH, 'F');
    setFill(doc, C.subtle); doc.rect(0, 0, 5, PH, 'F');

    // Mini header
    setFill(doc, C.navy);   doc.rect(0, 0, PW, 30, 'F');
    setFill(doc, C.accent); doc.rect(0, 30, PW, 1.2, 'F');

    doc.setFontSize(7.5); setFont(doc, 'bold'); setTxt(doc, C.accentLight);
    drawText(doc, `${ri + 1} OF ${reports.length}`, M, 10, { rtlX: RX });
    doc.setFontSize(14); setFont(doc, 'bold', report.title); setTxt(doc, C.white);
    const rTitleLines: string[] = doc.splitTextToSize(report.title, CW - 12);
    let ty = 19;
    rTitleLines.slice(0, 2).forEach((l: string) => { drawText(doc, l, M, ty, { rtlX: RX }); ty += 7; });

    y = 36;
    doc.setFontSize(7);
    let cx = rIsRTL ? RX : M;
    const chips: [string, RGB][] = [
      [CATEGORY_LABELS[report.category], C.navy],
      [PRIORITY_LABELS[report.priority], PRIORITY_COLOR[report.priority]],
      [STATUS_LABELS[report.status],     STATUS_COLOR[report.status]],
    ];
    if (rIsRTL) {
      chips.forEach(([label, color]) => {
        setFont(doc, 'bold', label);
        const w = doc.getTextWidth(label) + 10;
        cx -= w;
        setFill(doc, color); doc.roundedRect(cx, y - 5, w, 8, 2, 2, 'F');
        setTxt(doc, C.white); doc.setFontSize(7); setFont(doc, 'bold', label);
        doc.text(label, cx + 5, y);
        cx -= 4;
      });
    } else {
      chips.forEach(([label, color]) => { cx += pill(doc, label, cx, y, color); });
    }

    y = 47;
    doc.setFontSize(8); setFont(doc, 'normal'); setTxt(doc, C.mid);
    const meta: string[] = [format(new Date(report.createdAt), 'MMM d, yyyy  HH:mm')];
    if (report.projectName) meta.push(report.projectName);
    if (report.location)    meta.push(report.location);
    drawText(doc, meta.join('   ·   '), M, y, { rtlX: RX, maxWidth: CW });
    y += 10;

    const check = (needed: number) => {
      if (y + needed > PH - M - 16) {
        doc.addPage();
        setFill(doc, C.white);  doc.rect(0, 0, PW, PH, 'F');
        setFill(doc, C.subtle); doc.rect(0, 0, 5, PH, 'F');
        y = M;
      }
    };

    // Description
    if (report.description) {
      check(14);
      doc.setFontSize(11); setFont(doc, 'bold'); setTxt(doc, C.navy);
      drawText(doc, 'Description', M, y, { rtlX: RX }); y += 6;
      doc.setFontSize(10.5); setFont(doc, 'normal', report.description); setTxt(doc, C.charcoal);
      const lines: string[] = doc.splitTextToSize(report.description, CW);
      lines.forEach((l: string) => { check(6); drawText(doc, l, M, y, { rtlX: RX }); y += 6; });
      y += 6;
    }

    // Images — thumbnail grid
    if (report.images.length > 0) {
      check(14);
      doc.setFontSize(11); setFont(doc, 'bold'); setTxt(doc, C.navy);
      drawText(doc, `Attachments (${report.images.length})`, M, y, { rtlX: RX }); y += 6;

      const useGrid = report.images.length >= 2;
      const GCOL    = useGrid ? (CW - 5) / 2 : CW;
      const colPos  = useGrid ? [M, M + GCOL + 5] : [M];
      const aspects = await Promise.all(
        report.images.map(img => getImageAspect(img.annotatedDataUrl || img.dataUrl)),
      );

      if (useGrid) {
        let col = 0, rowStartY = y, maxRowH = 0;
        for (let i = 0; i < report.images.length; i++) {
          const img    = report.images[i];
          const src    = img.annotatedDataUrl || img.dataUrl;
          const aspect = aspects[i];
          const imgH   = Math.min((GCOL * aspect.h) / aspect.w, 65);
          const cellH  = imgH + 5;
          if (col === 0) { check(cellH + 6); rowStartY = y; maxRowH = 0; }
          setFill(doc, C.muted); doc.roundedRect(colPos[col] + 1, y + 1, GCOL, imgH, 2, 2, 'F');
          await addImage(doc, src, colPos[col], y, GCOL, imgH);
          if (img.caption) {
            doc.setFontSize(6.5); setFont(doc, 'normal', img.caption); setTxt(doc, C.mid);
            doc.text(img.caption, colPos[col], y + imgH + 4, { maxWidth: GCOL });
          }
          maxRowH = Math.max(maxRowH, cellH);
          col++;
          if (col >= 2 || i === report.images.length - 1) { y = rowStartY + maxRowH + 6; col = 0; }
        }
      } else {
        const img    = report.images[0];
        const src    = img.annotatedDataUrl || img.dataUrl;
        const aspect = aspects[0];
        const imgH   = Math.min((CW * aspect.h) / aspect.w, 90);
        check(imgH + 12);
        setFill(doc, C.muted); doc.roundedRect(M + 1.5, y + 1.5, CW, imgH, 2, 2, 'F');
        await addImage(doc, src, M, y, CW, imgH);
        y += imgH + 3;
        if (img.caption) {
          doc.setFontSize(8.5); setFont(doc, 'normal', img.caption); setTxt(doc, C.mid);
          drawText(doc, img.caption, M, y + 2, { maxWidth: CW, rtlX: RX }); y += 6;
        }
        y += 4;
      }

      // Full-quality photo gallery pages (same logic as single-report)
      for (let i = 0; i < report.images.length; i++) {
        const img  = report.images[i];
        const src  = img.annotatedDataUrl || img.dataUrl;
        const { w: iW, h: iH } = await getImageAspect(src);

        doc.addPage();
        setFill(doc, C.pageDark); doc.rect(0, 0, PW, PH, 'F');
        setFill(doc, C.accent);   doc.rect(0, 0, PW, 1.2, 'F');

        const PAD      = 10;
        const INFO_BAR = 20;
        const maxW     = PW - PAD * 2;
        const maxH     = PH - PAD - INFO_BAR - 2;

        let imgW = maxW;
        let imgH = (imgW * iH) / iW;
        if (imgH > maxH) { imgH = maxH; imgW = (imgH * iW) / iH; }
        const imgX = (PW - imgW) / 2;

        await addImage(doc, src, imgX, PAD, imgW, imgH);
        setDrw(doc, [45, 50, 75] as RGB); doc.setLineWidth(0.3);
        doc.rect(imgX, PAD, imgW, imgH);

        const barY = PH - INFO_BAR;
        setFill(doc, [18, 22, 40] as RGB); doc.rect(0, barY, PW, INFO_BAR, 'F');
        setFill(doc, C.accent);            doc.rect(0, barY, PW, 0.6, 'F');

        setFill(doc, C.accent);
        doc.roundedRect(M, barY + 6, 28, 7.5, 2, 2, 'F');
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
        doc.text(`Photo ${i + 1} of ${report.images.length}`, M + 14, barY + 11.2, { align: 'center' });

        if (img.annotatedDataUrl) {
          setFill(doc, C.accentDark);
          doc.roundedRect(M + 32, barY + 6, 20, 7.5, 2, 2, 'F');
          doc.setFontSize(6); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
          doc.text('ANNOTATED', M + 42, barY + 11.2, { align: 'center' });
        }

        if (img.caption) {
          doc.setFontSize(8.5); setFont(doc, 'normal', img.caption); setTxt(doc, C.light);
          drawText(doc, img.caption, isRTL ? RX : M + 56, barY + 10.5, {
            maxWidth: CW - 60, rtlX: isRTL ? M + 56 : undefined,
          });
        }

        const shortTitle = report.title.length > 34 ? report.title.slice(0, 34) + '…' : report.title;
        doc.setFontSize(7); setFont(doc, 'normal', shortTitle); setTxt(doc, [70, 78, 108] as RGB);
        drawText(doc, shortTitle, isRTL ? M : RX, barY + 11.5, {
          align: isRTL ? 'left' : 'right', rtlX: M,
        });
      }

      // New page for continuing content
      doc.addPage();
      setFill(doc, C.white);  doc.rect(0, 0, PW, PH, 'F');
      setFill(doc, C.subtle); doc.rect(0, 0, 5, PH, 'F');
      y = M;
    }

    // Notes
    if (report.notes) {
      check(18);
      doc.setFontSize(11); setFont(doc, 'bold'); setTxt(doc, C.navy);
      drawText(doc, 'Notes', M, y, { rtlX: RX }); y += 6;
      setFont(doc, 'normal', report.notes);
      const noteLines: string[] = doc.splitTextToSize(report.notes, CW - 12);
      const BOX_H = noteLines.length * 5.8 + 12;
      check(BOX_H + 4);
      setFill(doc, C.subtle); doc.roundedRect(M, y - 2, CW, BOX_H, 3, 3, 'F');
      setFill(doc, C.accent);
      if (rIsRTL) doc.rect(RX - 4, y - 2, 4, BOX_H, 'F');
      else         doc.rect(M,      y - 2, 4, BOX_H, 'F');
      setDrw(doc, C.muted); doc.setLineWidth(0.2);
      doc.roundedRect(M, y - 2, CW, BOX_H, 3, 3, 'D');
      doc.setFontSize(10.5); setFont(doc, 'normal', report.notes); setTxt(doc, C.charcoal);
      noteLines.forEach((l: string) => { drawText(doc, l, M + 10, y + 4, { rtlX: RX - 10 }); y += 5.8; });
      y += 10;
    }

    // Signature
    if (report.signatureDataUrl) {
      check(44);
      doc.setFontSize(11); setFont(doc, 'bold'); setTxt(doc, C.navy);
      drawText(doc, 'Digital Signature', M, y, { rtlX: RX }); y += 6;
      setFill(doc, C.subtle); doc.roundedRect(M, y - 2, CW, 38, 3, 3, 'F');
      setDrw(doc, C.muted);   doc.roundedRect(M, y - 2, CW, 38, 3, 3, 'D');
      const sigX = rIsRTL ? RX - 80 : M + 10;
      await addImage(doc, report.signatureDataUrl, sigX, y + 3, 70, 22);
      y += 27;
      setDrw(doc, C.mid); doc.line(sigX, y, sigX + 70, y); y += 4;
      if (report.signedBy) {
        doc.setFontSize(10); setFont(doc, 'bold', report.signedBy); setTxt(doc, C.dark);
        drawText(doc, report.signedBy, sigX, y, { rtlX: sigX + 70 }); y += 5;
      }
      if (report.signedAt) {
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
        doc.text('Signed: ' + format(new Date(report.signedAt), 'MMM d, yyyy  ·  HH:mm'), sigX, y);
      }
    }
  }

  // ── Fill TOC ────────────────────────────────────────────────────────────────
  doc.setPage(tocPageNum);
  setFill(doc, C.white);  doc.rect(0, 0, PW, PH, 'F');
  setFill(doc, C.subtle); doc.rect(0, 0, 5, PH, 'F');
  setFill(doc, C.navy);   doc.rect(0, 0, PW, 34, 'F');
  setFill(doc, C.accent); doc.rect(0, 34, PW, 1.4, 'F');

  doc.setFontSize(20); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
  doc.text('Table of Contents', isRTL ? RX : M, 22, { align: isRTL ? 'right' : 'left' });
  doc.setFontSize(9); setTxt(doc, C.accentLight);
  doc.text(`${reports.length} reports`, isRTL ? RX : M, 30, { align: isRTL ? 'right' : 'left' });

  let tocY = 50;
  reportPages.forEach((entry, i) => {
    if (i % 2 === 0) {
      setFill(doc, C.subtle); doc.rect(M, tocY - 7, CW, 14, 'F');
    }

    if (isRTL) {
      setFill(doc, C.accent); doc.circle(RX - 6, tocY - 1.5, 4.5, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(String(i + 1), RX - 6, tocY + 1, { align: 'center' });
      const title = entry.title.length > 42 ? entry.title.slice(0, 42) + '…' : entry.title;
      doc.setFontSize(10); setFont(doc, 'normal', entry.title); setTxt(doc, C.dark);
      doc.text(title, RX - 15, tocY, { align: 'right' });
      doc.setFontSize(6.5); setTxt(doc, C.mid); doc.setFont('helvetica', 'normal');
      doc.text(entry.category, RX - 15, tocY + 5.5, { align: 'right' });
      doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.accent);
      doc.text(String(entry.page), M + 2, tocY);
    } else {
      setFill(doc, C.accent); doc.circle(M + 6, tocY - 1.5, 4.5, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
      doc.text(String(i + 1), M + 6, tocY + 1, { align: 'center' });
      const title = entry.title.length > 42 ? entry.title.slice(0, 42) + '…' : entry.title;
      doc.setFontSize(10); setFont(doc, 'normal', entry.title); setTxt(doc, C.dark);
      doc.text(title, M + 15, tocY);
      doc.setFontSize(6.5); setTxt(doc, C.mid); doc.setFont('helvetica', 'normal');
      doc.text(entry.category, M + 15, tocY + 5.5);
      // Dot leader
      doc.setFontSize(7); setTxt(doc, C.muted);
      let dx = M + 15 + doc.getTextWidth(title) + 4;
      const stopX = PW - M - doc.getTextWidth(String(entry.page)) - 7;
      while (dx < stopX) { doc.text('.', dx, tocY); dx += 2.8; }
      doc.setFontSize(10.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.accent);
      doc.text(String(entry.page), PW - M - 2, tocY, { align: 'right' });
    }

    tocY += 15;
    if (tocY > PH - 24 && i < reportPages.length - 1) {
      doc.addPage();
      setFill(doc, C.white);  doc.rect(0, 0, PW, PH, 'F');
      setFill(doc, C.subtle); doc.rect(0, 0, 5, PH, 'F');
      tocY = M + 10;
    }
  });

  // ── Footers ─────────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    setFill(doc, C.subtle); doc.rect(0, PH - 14, PW, 14, 'F');
    setFill(doc, C.accent); doc.rect(0, PH - 14, PW, 0.6, 'F');
    doc.setFontSize(7); setTxt(doc, C.mid); doc.setFont('helvetica', 'normal');
    doc.text(`Batch Export  ·  ${reports.length} reports`, M, PH - 5.5);
    doc.setFontSize(8); setTxt(doc, C.accent); doc.setFont('helvetica', 'bold');
    doc.text(`${i} / ${total}`, PW - M, PH - 5.5, { align: 'right' });
  }

  // ── Save ─────────────────────────────────────────────────────────────────────
  const filename = `Batch_Report_${reports.length}_reports_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
  return savePdf(doc, filename);
}
