import jsPDF from 'jspdf';
import { Report, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/types/report';
import { format } from 'date-fns';
import { Filesystem, Directory } from '@capacitor/filesystem';

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
};

const PRIORITY_COLOR: Record<string, RGB> = {
  low: C.accent, medium: C.yellow, high: C.orange, critical: C.red,
};
const STATUS_COLOR: Record<string, RGB> = {
  draft: C.light, 'in-progress': C.accent, completed: C.green, archived: C.mid,
};

function setFill(doc: jsPDF, c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function setTxt(doc: jsPDF, c: RGB)  { doc.setTextColor(c[0], c[1], c[2]); }
function setDrw(doc: jsPDF, c: RGB)  { doc.setDrawColor(c[0], c[1], c[2]); }

function pill(doc: jsPDF, text: string, x: number, y: number, color: RGB) {
  const w = doc.getTextWidth(text) + 6;
  setFill(doc, color);
  doc.roundedRect(x, y - 4.5, w, 6.5, 1.5, 1.5, 'F');
  setTxt(doc, C.white);
  doc.setFontSize(7); doc.setFont('helvetica', 'bold');
  doc.text(text, x + 3, y);
  return w + 3;
}

function fmtHours(h: number): string {
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  if (hours === 0) return mins + 'm';
  if (mins === 0) return hours + 'h';
  return hours + 'h ' + mins + 'm';
}

export async function exportReportToPdf(report: Report) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const M = 16;
  const CW = PW - M * 2;
  let y = M;
  const tocEntries: { title: string; page: number }[] = [];

  const drawFooter = (pg: number, total?: number) => {
    setDrw(doc, C.muted); doc.line(M, PH - 10, PW - M, PH - 10);
    doc.setFontSize(7); setTxt(doc, C.light); doc.setFont('helvetica', 'normal');
    doc.text('Report ID: ' + report.id, M, PH - 5.5);
    if (total) doc.text(pg + ' / ' + total, PW - M, PH - 5.5, { align: 'right' });
  };

  const check = (needed: number) => {
    if (y + needed > PH - M - 10) { doc.addPage(); y = M; }
  };

  const section = (title: string) => {
    check(16);
    tocEntries.push({ title, page: doc.getNumberOfPages() });
    setFill(doc, C.accent); doc.rect(M, y, 3, 9, 'F');
    doc.setFontSize(12); doc.setFont('helvetica', 'bold'); setTxt(doc, C.navy);
    doc.text(title, M + 6, y + 6.5);
    setDrw(doc, C.muted); doc.line(M + 6, y + 9, PW - M, y + 9);
    y += 14;
  };

  // PAGE 1 — COVER
  setFill(doc, C.navy); doc.rect(0, 0, PW, PH, 'F');
  setFill(doc, C.accent); doc.rect(0, PH * 0.58, PW, 1.5, 'F');

  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setTxt(doc, C.accent);
  doc.text(CATEGORY_LABELS[report.category].toUpperCase(), M, 28);

  doc.setFontSize(24); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
  const titleLines: string[] = doc.splitTextToSize(report.title, CW);
  let cy = 42;
  titleLines.forEach((l: string) => { doc.text(l, M, cy); cy += 10; });

  let cx = M;
  const chips: [string, RGB][] = [
    [PRIORITY_LABELS[report.priority], PRIORITY_COLOR[report.priority]],
    [STATUS_LABELS[report.status], STATUS_COLOR[report.status]],
  ];
  if (report.lostTimeHours && report.lostTimeHours > 0) {
    chips.push([fmtHours(report.lostTimeHours) + ' lost', C.orange]);
  }
  chips.forEach(([label, color]) => { cx += pill(doc, label, cx, cy + 5, color); });

  const infoY = PH * 0.64;
  const infoRows: [string, string][] = [
    ['Date', format(new Date(report.createdAt), 'MMMM d, yyyy')],
    ['Time', format(new Date(report.createdAt), 'HH:mm')],
    ...(report.projectName ? [['Project', report.projectName] as [string,string]] : []),
    ...(report.location   ? [['Location', report.location]   as [string,string]] : []),
    ...(report.lostTimeHours && report.lostTimeHours > 0 ? [['Lost Time', fmtHours(report.lostTimeHours)] as [string,string]] : []),
    ...(report.signedBy   ? [['Signed by', report.signedBy]  as [string,string]] : []),
  ];
  doc.setFont('helvetica', 'normal');
  infoRows.forEach(([label, value], i) => {
    doc.setFontSize(7); setTxt(doc, C.light); doc.text(label, M, infoY + i * 7);
    doc.setFontSize(9); setTxt(doc, C.white); doc.text(value, M + 30, infoY + i * 7);
  });

  if (report.images.length > 0) {
    doc.setFontSize(8); setTxt(doc, C.accent);
    doc.text(report.images.length + ' image' + (report.images.length !== 1 ? 's' : '') + ' attached', PW - M, PH - 16, { align: 'right' });
  }

  // PAGE 2 — TOC placeholder
  doc.addPage();
  const tocPage = doc.getNumberOfPages();

  // CONTENT
  doc.addPage(); y = M;

  // Description
  if (report.description) {
    section('Description');
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
    const lines: string[] = doc.splitTextToSize(report.description, CW);
    lines.forEach((l: string) => { check(6); doc.text(l, M, y); y += 5.5; });
    y += 5;
  }

  // Lost Time section
  if (report.lostTimeHours && report.lostTimeHours > 0) {
    section('Lost Time');
    check(28);
    // Orange box
    setFill(doc, [255, 237, 213]); // orange-100 equivalent
    doc.roundedRect(M, y - 2, CW, 22, 2, 2, 'F');
    setDrw(doc, C.orange); doc.roundedRect(M, y - 2, CW, 22, 2, 2, 'D');
    setFill(doc, C.orange); doc.rect(M, y - 2, 3, 22, 'F');

    doc.setFontSize(22); doc.setFont('helvetica', 'bold'); setTxt(doc, C.orange);
    doc.text(fmtHours(report.lostTimeHours), M + 8, y + 10);

    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
    doc.text('Recorded downtime / delay for this incident', M + 8, y + 16);

    y += 26;
  }

  // Attachments
  if (report.images.length > 0) {
    section('Attachments  (' + report.images.length + ')');
    for (let i = 0; i < report.images.length; i++) {
      const img = report.images[i];
      const src = img.annotatedDataUrl || img.dataUrl;
      const imgH = 85;
      check(imgH + 14);
      try {
        doc.addImage(src, 'JPEG', M, y, CW, imgH);
        if (img.annotatedDataUrl) {
          setFill(doc, C.accent); doc.roundedRect(M + 2, y + 2, 24, 7, 2, 2, 'F');
          doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
          doc.text('ANNOTATED', M + 4, y + 6.5);
        }
      } catch { /* skip */ }
      y += imgH + 2;
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
      if (img.caption) doc.text(img.caption, M, y + 4);
      setTxt(doc, C.light);
      doc.text((i + 1) + ' / ' + report.images.length, PW - M, y + 4, { align: 'right' });
      setDrw(doc, C.muted); doc.line(M, y + 6, PW - M, y + 6);
      y += 10;
    }
  }

  // Notes
  if (report.notes) {
    section('Notes');
    const noteLines: string[] = doc.splitTextToSize(report.notes, CW - 8);
    const boxH = noteLines.length * 5.5 + 10;
    check(boxH + 4);
    setFill(doc, C.bg); doc.roundedRect(M, y - 2, CW, boxH, 2, 2, 'F');
    setDrw(doc, C.muted); doc.roundedRect(M, y - 2, CW, boxH, 2, 2, 'D');
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
    noteLines.forEach((l: string) => { doc.text(l, M + 5, y + 5); y += 5.5; });
    y += 10;
  }

  // Signature
  if (report.signatureDataUrl) {
    section('Digital Signature');
    check(42);
    try { doc.addImage(report.signatureDataUrl, 'PNG', M, y, 72, 26); } catch { /* skip */ }
    y += 28;
    setDrw(doc, C.mid); doc.line(M, y, M + 72, y); y += 5;
    if (report.signedBy) {
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); setTxt(doc, C.dark);
      doc.text(report.signedBy, M, y); y += 5;
    }
    if (report.signedAt) {
      doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); setTxt(doc, C.mid);
      doc.text('Signed: ' + format(new Date(report.signedAt), 'MMMM d, yyyy  HH:mm'), M, y);
    }
  }

  // FILL TABLE OF CONTENTS
  doc.setPage(tocPage);
  setFill(doc, C.navy); doc.rect(0, 0, PW, 30, 'F');
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); setTxt(doc, C.white);
  doc.text('Table of Contents', M, 20);
  let ty = 44;
  tocEntries.forEach((entry, i) => {
    if (i % 2 === 0) { setFill(doc, C.bg); doc.rect(M, ty - 5.5, CW, 9, 'F'); }
    doc.setFontSize(10); doc.setFont('helvetica', 'normal'); setTxt(doc, C.dark);
    doc.text(entry.title, M + 3, ty);
    const pageLabel = 'p. ' + entry.page;
    doc.setFontSize(7); setTxt(doc, C.muted);
    let dx = M + 3 + doc.getTextWidth(entry.title) + 2;
    const stopX = PW - M - doc.getTextWidth(pageLabel) - 3;
    while (dx < stopX) { doc.text('.', dx, ty); dx += 2.5; }
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); setTxt(doc, C.accent);
    doc.text(pageLabel, PW - M, ty, { align: 'right' });
    ty += 10;
  });

  // Footers
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i); drawFooter(i, total);
  }

  const filename = 'Report_' + report.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30) + '_' + format(new Date(report.createdAt), 'yyyyMMdd') + '.pdf';

  try {
    const base64 = doc.output('datauristring').split(',')[1];
    await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Data, recursive: true });
    return { saved: true, path: filename };
  } catch {
    doc.save(filename);
    return { saved: false, path: filename };
  }
}
