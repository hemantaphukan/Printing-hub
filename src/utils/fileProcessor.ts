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
 * Creates an UploadedFileData structure for a dual-sided document or ID card (Front & Back photos).
 */
export function createDualSideImageJob(
  front: { dataUrl: string; fileName: string; fileSize: number },
  back: { dataUrl: string; fileName: string; fileSize: number },
  layout: 'stacked-1page' | 'side-by-side-1page' | 'separate-2pages' = 'stacked-1page',
  contrastFilter = false
): UploadedFileData {
  const pageCount = layout === 'separate-2pages' ? 2 : 1;
  const totalSize = front.fileSize + back.fileSize;
  const cleanFrontName = front.fileName.replace(/\.[^/.]+$/, '');

  return {
    fileName: `ID_Card_Front_Back_${cleanFrontName}.pdf`,
    fileSize: totalSize,
    mimeType: 'image/jpeg',
    category: 'image',
    isDualSideId: true,
    frontImage: {
      dataUrl: front.dataUrl,
      fileName: front.fileName,
      fileSize: front.fileSize,
    },
    backImage: {
      dataUrl: back.dataUrl,
      fileName: back.fileName,
      fileSize: back.fileSize,
    },
    dualLayout: layout,
    documentContrastFilter: contrastFilter,
    pageCount,
    imageFit: 'fit-page',
  };
}

/**
 * Creates sample Front & Back ID Card images on-the-fly for quick 1-click test.
 */
export function createSampleDualSideIdData(
  layout: 'stacked-1page' | 'side-by-side-1page' | 'separate-2pages' = 'stacked-1page'
): {
  front: { dataUrl: string; fileName: string; fileSize: number };
  back: { dataUrl: string; fileName: string; fileSize: number };
} {
  // Generate crisp SVG data URLs for sample ID cards
  const frontSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
      <rect width="600" height="380" rx="20" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
      <!-- Top banner -->
      <rect x="0" y="0" width="600" height="70" rx="20" fill="#0f172a"/>
      <rect x="0" y="50" width="600" height="20" fill="#0f172a"/>
      <text x="30" y="42" fill="#38bdf8" font-family="sans-serif" font-weight="900" font-size="22" letter-spacing="1">NATIONAL IDENTITY CARD</text>
      <text x="560" y="42" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="14" text-anchor="end">FRONT SIDE</text>
      
      <!-- Photo box -->
      <rect x="35" y="95" width="160" height="200" rx="12" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
      <!-- Silhouette avatar -->
      <circle cx="115" cy="165" r="45" fill="#64748b"/>
      <path d="M 60 270 C 60 220, 170 220, 170 270 Z" fill="#64748b"/>
      <rect x="45" y="308" width="140" height="24" rx="4" fill="#0284c7"/>
      <text x="115" y="324" fill="#ffffff" font-family="sans-serif" font-weight="bold" font-size="11" text-anchor="middle">VERIFIED CITIZEN</text>

      <!-- Details -->
      <text x="225" y="125" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">FULL NAME</text>
      <text x="225" y="150" fill="#0f172a" font-family="sans-serif" font-size="20" font-weight="900">ALEX M. REYNOLDS</text>

      <text x="225" y="190" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">ID NUMBER / LICENSE NO.</text>
      <text x="225" y="215" fill="#0284c7" font-family="monospace" font-size="20" font-weight="bold">ID-9482-8491-X</text>

      <g transform="translate(225, 245)">
        <text x="0" y="0" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="bold">DATE OF BIRTH</text>
        <text x="0" y="20" fill="#1e293b" font-family="sans-serif" font-size="15" font-weight="bold">14 MAY 1994</text>
      </g>

      <g transform="translate(410, 245)">
        <text x="0" y="0" fill="#64748b" font-family="sans-serif" font-size="11" font-weight="bold">EXPIRES</text>
        <text x="0" y="20" fill="#b91c1c" font-family="sans-serif" font-size="15" font-weight="bold">31 DEC 2030</text>
      </g>

      <!-- Hologram seal symbol -->
      <circle cx="530" cy="150" r="30" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="6,4"/>
      <text x="530" y="155" fill="#d97706" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">OFFICIAL</text>
      
      <!-- Bottom chip bar -->
      <rect x="225" y="310" width="340" height="18" rx="4" fill="#f1f5f9"/>
      <text x="235" y="323" fill="#64748b" font-family="monospace" font-size="11">CHIP ID: A84F-992C • CLASS: MOTOR VEHICLE</text>
    </svg>
  `;

  const backSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
      <rect width="600" height="380" rx="20" fill="#f8fafc" stroke="#cbd5e1" stroke-width="4"/>
      <!-- Magnetic Stripe -->
      <rect x="0" y="25" width="600" height="55" fill="#1e293b"/>

      <!-- Header -->
      <text x="35" y="115" fill="#64748b" font-family="sans-serif" font-weight="bold" font-size="12">RESIDENTIAL ADDRESS</text>
      <text x="35" y="140" fill="#0f172a" font-family="sans-serif" font-weight="bold" font-size="16">742 EVERGREEN TERRACE, SUITE 400</text>
      <text x="35" y="162" fill="#0f172a" font-family="sans-serif" font-weight="bold" font-size="16">SAN FRANCISCO, CA 94107, USA</text>

      <text x="35" y="200" fill="#64748b" font-family="sans-serif" font-weight="bold" font-size="12">EMERGENCY CONTACT / ORGAN DONOR</text>
      <text x="35" y="222" fill="#0f172a" font-family="sans-serif" font-weight="bold" font-size="15">DONOR: YES • CONTACT: +1 (555) 382-9104</text>

      <!-- Simulated Barcode -->
      <g transform="translate(35, 255)">
        <rect x="0" y="0" width="530" height="60" fill="#ffffff" stroke="#cbd5e1"/>
        <!-- barcode stripes -->
        <line x1="20" y1="8" x2="20" y2="52" stroke="#000" stroke-width="3"/>
        <line x1="28" y1="8" x2="28" y2="52" stroke="#000" stroke-width="1"/>
        <line x1="33" y1="8" x2="33" y2="52" stroke="#000" stroke-width="5"/>
        <line x1="44" y1="8" x2="44" y2="52" stroke="#000" stroke-width="2"/>
        <line x1="52" y1="8" x2="52" y2="52" stroke="#000" stroke-width="4"/>
        <line x1="62" y1="8" x2="62" y2="52" stroke="#000" stroke-width="2"/>
        <line x1="70" y1="8" x2="70" y2="52" stroke="#000" stroke-width="6"/>
        <line x1="82" y1="8" x2="82" y2="52" stroke="#000" stroke-width="1"/>
        <line x1="90" y1="8" x2="90" y2="52" stroke="#000" stroke-width="4"/>
        <line x1="102" y1="8" x2="102" y2="52" stroke="#000" stroke-width="3"/>
        <line x1="112" y1="8" x2="112" y2="52" stroke="#000" stroke-width="5"/>
        <line x1="124" y1="8" x2="124" y2="52" stroke="#000" stroke-width="2"/>
        <line x1="135" y1="8" x2="135" y2="52" stroke="#000" stroke-width="3"/>
        <line x1="145" y1="8" x2="145" y2="52" stroke="#000" stroke-width="6"/>
        <line x1="160" y1="8" x2="160" y2="52" stroke="#000" stroke-width="2"/>
        <line x1="170" y1="8" x2="170" y2="52" stroke="#000" stroke-width="4"/>
        <line x1="182" y1="8" x2="182" y2="52" stroke="#000" stroke-width="5"/>
        <line x1="195" y1="8" x2="195" y2="52" stroke="#000" stroke-width="1"/>
        <line x1="205" y1="8" x2="205" y2="52" stroke="#000" stroke-width="6"/>
        <line x1="220" y1="8" x2="220" y2="52" stroke="#000" stroke-width="3"/>
        <line x1="232" y1="8" x2="232" y2="52" stroke="#000" stroke-width="4"/>
        <line x1="245" y1="8" x2="245" y2="52" stroke="#000" stroke-width="2"/>
        <line x1="255" y1="8" x2="255" y2="52" stroke="#000" stroke-width="5"/>
        <line x1="270" y1="8" x2="270" y2="52" stroke="#000" stroke-width="3"/>
        <line x1="282" y1="8" x2="282" y2="52" stroke="#000" stroke-width="6"/>
        <line x1="298" y1="8" x2="298" y2="52" stroke="#000" stroke-width="2"/>
        <line x1="310" y1="8" x2="310" y2="52" stroke="#000" stroke-width="4"/>
        <line x1="322" y1="8" x2="322" y2="52" stroke="#000" stroke-width="5"/>
        <line x1="338" y1="8" x2="338" y2="52" stroke="#000" stroke-width="3"/>
        <line x1="350" y1="8" x2="350" y2="52" stroke="#000" stroke-width="6"/>
        <line x1="365" y1="8" x2="365" y2="52" stroke="#000" stroke-width="2"/>
        <line x1="378" y1="8" x2="378" y2="52" stroke="#000" stroke-width="4"/>
        <line x1="390" y1="8" x2="390" y2="52" stroke="#000" stroke-width="5"/>
        <line x1="405" y1="8" x2="405" y2="52" stroke="#000" stroke-width="2"/>
        <line x1="418" y1="8" x2="418" y2="52" stroke="#000" stroke-width="6"/>
        <line x1="432" y1="8" x2="432" y2="52" stroke="#000" stroke-width="3"/>
        <line x1="445" y1="8" x2="445" y2="52" stroke="#000" stroke-width="4"/>
        <line x1="460" y1="8" x2="460" y2="52" stroke="#000" stroke-width="2"/>
        <line x1="472" y1="8" x2="472" y2="52" stroke="#000" stroke-width="5"/>
        <line x1="485" y1="8" x2="485" y2="52" stroke="#000" stroke-width="3"/>
        <line x1="500" y1="8" x2="500" y2="52" stroke="#000" stroke-width="4"/>
      </g>
      
      <text x="35" y="340" fill="#64748b" font-family="monospace" font-size="11">PDF-417 COMPLIANT 2D SECURE BARCODE • BACK SIDE</text>
      <text x="560" y="340" fill="#94a3b8" font-family="sans-serif" font-weight="bold" font-size="12" text-anchor="end">ISSUED BY GOVT</text>
    </svg>
  `;

  const frontDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(frontSvg)}`;
  const backDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(backSvg)}`;

  return {
    front: {
      dataUrl: frontDataUrl,
      fileName: 'Sample_ID_Card_Front.jpg',
      fileSize: 94200,
    },
    back: {
      dataUrl: backDataUrl,
      fileName: 'Sample_ID_Card_Back.jpg',
      fileSize: 88700,
    },
  };
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
