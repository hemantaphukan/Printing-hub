import LZString from 'lz-string';
import QRCode from 'qrcode';
import { PrintJob } from '../types';

const URL_PREFIX = '#print=';
const STATION_HASH = '#station';

export function buildCustomerUploadUrl(): string {
  const origin = window.location.origin || '';
  const pathname = window.location.pathname || '/';
  return `${origin}${pathname}?mode=customer`;
}

export function isCustomerModeUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'customer') return true;
  if (window.location.hash.includes('customer')) return true;
  return false;
}

export function createStationJob(): PrintJob {
  return {
    id: `station-${Date.now().toString(36)}`,
    title: 'Mobile Universal Print Station',
    createdAt: new Date().toISOString(),
    type: 'uploaded-file',
    paperSize: 'letter',
    orientation: 'portrait',
    colorMode: 'color',
    autoTrigger: false,
    fontScale: 'md',
    uploadedFile: {
      fileName: 'Tap to select any file to print',
      fileSize: 0,
      mimeType: '*/*',
      category: 'other',
      pageCount: 1,
      showPageNumbers: true,
    },
  };
}

/**
 * Builds a Universal Station URL that allows anyone who scans the QR code to select and print any file on their phone.
 */
export function buildStationUrl(): string {
  const origin = window.location.origin || '';
  const pathname = window.location.pathname || '/';
  return `${origin}${pathname}${STATION_HASH}`;
}

/**
 * Encodes a PrintJob into a compact URL-safe string.
 */
export function encodePrintJob(job: PrintJob): string {
  try {
    // For large uploaded files with rendered canvas pages or huge data URLs,
    // cache full object locally and encode a clean payload to avoid exceeding URL limits
    let jobToEncode = job;
    if (job.uploadedFile && (job.uploadedFile.pdfPages || (job.uploadedFile.dataUrl && job.uploadedFile.dataUrl.length > 50000))) {
      try {
        localStorage.setItem(`cached_print_job_${job.id}`, JSON.stringify(job));
      } catch (e) {
        console.warn('Could not cache large job to localStorage:', e);
      }
      
      // Create light descriptor for URL
      jobToEncode = {
        ...job,
        uploadedFile: {
          ...job.uploadedFile,
          pdfPages: undefined, // omitted from URL to prevent massive QR code
          dataUrl: job.uploadedFile.dataUrl && job.uploadedFile.dataUrl.length < 50000 ? job.uploadedFile.dataUrl : undefined,
        },
      };
    }

    const jsonStr = JSON.stringify(jobToEncode);
    const compressed = LZString.compressToEncodedURIComponent(jsonStr);
    return compressed;
  } catch (err) {
    console.error('Failed to compress PrintJob:', err);
    // Fallback to base64
    return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(job)))));
  }
}

/**
 * Decodes a compressed or encoded string back into a PrintJob.
 */
export function decodePrintJob(payload: string): PrintJob | null {
  if (!payload) return null;

  try {
    // Try LZ-String decompression first
    const decompressed = LZString.decompressFromEncodedURIComponent(payload);
    if (decompressed) {
      const parsed = JSON.parse(decompressed) as PrintJob;
      // Check if there is a cached full version with binary data
      if (parsed.id) {
        try {
          const cached = localStorage.getItem(`cached_print_job_${parsed.id}`);
          if (cached) {
            return JSON.parse(cached) as PrintJob;
          }
        } catch {
          // ignore
        }
      }
      return parsed;
    }
  } catch {
    // Fall through to fallback
  }

  try {
    // Try plain base64 decode
    const json = decodeURIComponent(escape(atob(decodeURIComponent(payload))));
    return JSON.parse(json) as PrintJob;
  } catch (err) {
    console.warn('Failed to parse PrintJob payload:', err);
    return null;
  }
}

/**
 * Builds the full absolute URL for a PrintJob that a mobile camera can open directly.
 */
export function buildPrintUrl(job: PrintJob): string {
  const encoded = encodePrintJob(job);
  // Detect current base URL
  const origin = window.location.origin || '';
  const pathname = window.location.pathname || '/';
  return `${origin}${pathname}${URL_PREFIX}${encoded}`;
}

/**
 * Extracts a PrintJob from the current window.location (hash or search).
 */
export function getPrintJobFromUrl(): PrintJob | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (hash.startsWith(URL_PREFIX)) {
    const payload = hash.slice(URL_PREFIX.length);
    return decodePrintJob(payload);
  }

  // Check if opened with station hash (#station or #mode=station)
  if (hash.includes('station')) {
    return createStationJob();
  }

  // Also check query param ?print= or ?station=
  const params = new URLSearchParams(window.location.search);
  const printParam = params.get('print');
  if (printParam) {
    return decodePrintJob(printParam);
  }

  if (params.get('station') === 'true' || params.get('station') === '1') {
    return createStationJob();
  }

  return null;
}

/**
 * Generates a high-quality QR code data URL (PNG) from a given URL string.
 */
export async function generateQrDataUrl(url: string, margin = 2, size = 380): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin,
      width: size,
      color: {
        dark: '#0f172a', // Deep slate for crisp contrast
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
}
