import jsPDF from 'jspdf';
import { Report, CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from '@/types/report';
import { format } from 'date-fns';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export async function exportReportToPdf(report: Report) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header bar
  doc.setFillColor(30, 41, 69); // primary navy
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(report.title, margin, 16);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('PVP Report', margin, 24);
  doc.text(format(new Date(report.createdAt), 'MMMM d, yyyy — HH:mm'), pageWidth - margin, 24, { align: 'right' });
  y = 40;

  // Meta section
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  const metaItems: string[] = [
    `Category: ${CATEGORY_LABELS[report.category]}`,
    `Priority: ${PRIORITY_LABELS[report.priority]}`,
    `Status: ${STATUS_LABELS[report.status]}`,
  ];
  if (report.projectName) metaItems.push(`Project: ${report.projectName}`);
  if (report.location) metaItems.push(`Location: ${report.location}`);
  doc.text(metaItems.join('   •   '), margin, y);
  y += 8;

  // Divider
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Description
  if (report.description) {
    checkPage(20);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('DESCRIPTION', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(report.description, contentWidth);
    for (const line of lines) {
      checkPage(6);
      doc.text(line, margin, y);
      y += 5;
    }
    y += 4;
  }

  // Images
  if (report.images.length > 0) {
    checkPage(20);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`ATTACHMENTS (${report.images.length})`, margin, y);
    y += 6;

    const imgSize = (contentWidth - 4) / 2;
    for (let i = 0; i < report.images.length; i += 2) {
      checkPage(imgSize + 4);
      try {
        doc.addImage(report.images[i].dataUrl, 'JPEG', margin, y, imgSize, imgSize);
      } catch { /* skip broken images */ }
      if (report.images[i + 1]) {
        try {
          doc.addImage(report.images[i + 1].dataUrl, 'JPEG', margin + imgSize + 4, y, imgSize, imgSize);
        } catch { /* skip */ }
      }
      y += imgSize + 4;
    }
    y += 2;
  }

  // Notes
  if (report.notes) {
    checkPage(20);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTES', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(report.notes, contentWidth);
    for (const line of lines) {
      checkPage(6);
      doc.text(line, margin, y);
      y += 5;
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(160, 160, 160);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    doc.text(`Report ID: ${report.id}`, margin, doc.internal.pageSize.getHeight() - 8);
  }

  const filename = `PVP_Report_${report.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}_${format(new Date(report.createdAt), 'yyyyMMdd')}.pdf`;

  try {
    const base64 = doc.output('datauristring').split(',')[1];
    await Filesystem.writeFile({
      path: `Download/${filename}`,
      data: base64,
      directory: Directory.ExternalStorage,
      recursive: true,
    });
    return { saved: true, path: `Download/${filename}` };
  } catch {
    // Fallback to browser download
    doc.save(filename);
    return { saved: false, path: filename };
  }
}
