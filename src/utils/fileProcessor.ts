import { PrintJob, UploadedFileData, PaperSize } from '../types';
import { renderPdfPages, RenderedPdfPage } from './pdfHelper';

/**
 * Categorizes a file based on MIME type or filename extension.
 */
export function getFileCategory(file: { name: string; type?: string }): UploadedFileData['category'] {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = file.type?.toLowerCase() || '';

  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp', 'heic', 'tiff'].includes(ext)
  ) {
    return 'image';
  }
  if (
    mime.startsWith('text/') ||
    ['txt', 'md', 'csv', 'json', 'log', 'xml', 'yaml', 'yml', 'js', 'ts', 'jsx', 'tsx', 'html', 'css'].includes(ext)
  ) {
    return 'text';
  }
  if (['doc', 'docx', 'rtf', 'odt', 'pages', 'xls', 'xlsx'].includes(ext)) {
    return 'document';
  }
  return 'other';
}

/**
 * Format human-readable file size
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Process any uploaded File or Blob into an UploadedFileData structure and PrintJob.
 */
export async function processUploadedFile(
  file: File,
  onProgress?: (step: string) => void
): Promise<PrintJob> {
  const category = getFileCategory(file);
  const fileName = file.name;
  const fileSize = file.size;
  const mimeType = file.type || 'application/octet-stream';

  onProgress?.(`Processing ${fileName}...`);

  let dataUrl: string | undefined;
  let textPreview: string | undefined;
  let pageCount = 1;
  let pdfPages: RenderedPdfPage[] | undefined;
  let defaultPaperSize: PaperSize = 'letter';

  if (category === 'pdf') {
    onProgress?.('Rendering PDF pages for high-resolution print...');
    const arrayBuffer = await file.arrayBuffer();
    
    // Create base64 Data URL for fallback/direct opening
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    dataUrl = URL.createObjectURL(blob);

    try {
      // Render pages into sharp canvas images for native multi-page @media print
      const rendered = await renderPdfPages(arrayBuffer, 40);
      pdfPages = rendered;
      pageCount = rendered.length || 1;
    } catch (err) {
      console.warn('PDF.js rendering fallback to object URL:', err);
      pageCount = 1;
    }
  } else if (category === 'image') {
    onProgress?.('Preparing image for print layout...');
    dataUrl = await readFileAsDataUrl(file);
    pageCount = 1;
  } else if (category === 'text') {
    onProgress?.('Formatting text document...');
    const rawText = await file.text();
    textPreview = rawText;
    dataUrl = await readFileAsDataUrl(file);
    // Rough estimate of pages based on character/line count
    const lines = rawText.split('\n').length;
    pageCount = Math.max(1, Math.ceil(lines / 48));
  } else {
    // Document or other file
    onProgress?.('Loading file contents...');
    dataUrl = await readFileAsDataUrl(file);
    try {
      textPreview = await file.text();
      // If it looks like binary or garbage, don't show full text preview
      if (/[\x00-\x08\x0E-\x1F]/.test(textPreview.slice(0, 100))) {
        textPreview = undefined;
      }
    } catch {
      textPreview = undefined;
    }
  }

  const uploadedData: UploadedFileData = {
    fileName,
    fileSize,
    mimeType,
    category,
    dataUrl,
    textPreview,
    pageCount,
    pdfPages,
    imageFit: 'fit-page',
    documentContrastFilter: false,
    showPageNumbers: true,
  };

  return {
    id: `print-${Date.now().toString(36)}`,
    title: fileName,
    createdAt: new Date().toISOString(),
    type: 'uploaded-file',
    paperSize: defaultPaperSize,
    orientation: 'portrait',
    colorMode: 'color',
    autoTrigger: false,
    fontScale: 'md',
    uploadedFile: uploadedData,
  };
}

/**
 * Helper to read file as Data URL
 */
export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Creates a sample printable document on-the-fly for quick zero-setup testing.
 */
export function createSamplePdfJob(): PrintJob {
  return {
    id: 'sample-boarding-pass-pdf',
    title: 'Flight_Boarding_Pass_AA-1942.pdf',
    createdAt: new Date().toISOString(),
    type: 'uploaded-file',
    paperSize: 'letter',
    orientation: 'portrait',
    colorMode: 'color',
    autoTrigger: false,
    fontScale: 'md',
    uploadedFile: {
      fileName: 'Flight_Boarding_Pass_AA-1942.pdf',
      fileSize: 184500,
      mimeType: 'application/pdf',
      category: 'pdf',
      pageCount: 1,
      imageFit: 'fit-page',
      showPageNumbers: true,
      textPreview: `AMERICAN AIRLINES - ELECTRONIC BOARDING PASS
PASSENGER: CHEN / ALEXANDER
FLIGHT: AA 1942 | SEAT: 12F (WINDOW)
DATE: TODAY | GATE: B22 | BOARDING TIME: 14:15
FROM: SFO (SAN FRANCISCO INTL)
TO: JFK (NEW YORK KENNEDY)
CLASS: PRIORITY MAIN CABIN
GROUP: 3 | ETKT: 00178492019482
BARCODE: M1CHEN/ALEXANDER EAA1942 12FSFOJFKAA 12F003

IMPORTANT TRAVEL NOTICES:
• Gate closes strictly 15 minutes prior to departure.
• Identification must match passenger name exactly.
• Carry-on bags must fit under the seat or in overhead bins.`,
    },
  };
}
