import jsPDF from 'jspdf';

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** Returns true if the string contains Arabic characters */
export function hasArabic(text: string): boolean {
  return ARABIC_RANGE.test(text);
}

/** Register Amiri Arabic fonts on a jsPDF instance (lazy-loaded) */
export async function registerArabicFonts(doc: jsPDF) {
  const [{ amiriRegularBase64 }, { amiriBoldBase64 }] = await Promise.all([
    import('./amiri-regular-font'),
    import('./amiri-bold-font'),
  ]);

  doc.addFileToVFS('Amiri-Regular.ttf', amiriRegularBase64);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');

  doc.addFileToVFS('Amiri-Bold.ttf', amiriBoldBase64);
  doc.addFont('Amiri-Bold.ttf', 'Amiri', 'bold');
}

/** Set font to Amiri (Arabic) or Helvetica based on text content */
export function setFontAware(doc: jsPDF, style: 'normal' | 'bold', text?: string) {
  const useArabic = text ? hasArabic(text) : false;
  doc.setFont(useArabic ? 'Amiri' : 'helvetica', style);
}

/** Get the appropriate font name for the given text */
export function getFontName(text: string): string {
  return hasArabic(text) ? 'Amiri' : 'helvetica';
}

/**
 * Draw text with automatic RTL support for Arabic.
 * For Arabic text, renders right-aligned from the given x position (or page right margin).
 */
export function drawTextRTL(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options?: { maxWidth?: number; align?: string; rightX?: number }
) {
  if (hasArabic(text)) {
    const font = doc.getFont();
    doc.setFont('Amiri', font.fontStyle as 'normal' | 'bold');
    
    // For Arabic, default to right-align
    const alignX = options?.rightX ?? x;
    doc.text(text, alignX, y, { 
      align: 'right',
      maxWidth: options?.maxWidth 
    });
  } else {
    doc.text(text, x, y, { 
      align: (options?.align as any) || 'left',
      maxWidth: options?.maxWidth 
    });
  }
}

/**
 * Split text to size using the correct font, then draw each line
 * with RTL support for Arabic text.
 */
export function splitAndDrawRTL(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  rightX?: number
): number {
  const isAr = hasArabic(text);
  if (isAr) {
    const font = doc.getFont();
    doc.setFont('Amiri', font.fontStyle as 'normal' | 'bold');
  }
  
  const lines: string[] = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line: string) => {
    if (isAr) {
      doc.text(line, rightX ?? x, y, { align: 'right' });
    } else {
      doc.text(line, x, y);
    }
    y += lineHeight;
  });
  
  return y;
}
