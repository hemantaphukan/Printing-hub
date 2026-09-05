import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker using CDN matching the installed version, or bundled fallback
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface RenderedPdfPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Loads a PDF from a base64 Data URL or ArrayBuffer and renders all its pages to high-resolution image data URLs.
 */
export async function renderPdfPages(
  dataUrlOrArrayBuffer: string | ArrayBuffer,
  maxPages = 30
): Promise<RenderedPdfPage[]> {
  try {
    let loadingTask;
    if (typeof dataUrlOrArrayBuffer === 'string') {
      loadingTask = pdfjsLib.getDocument({ url: dataUrlOrArrayBuffer });
    } else {
      loadingTask = pdfjsLib.getDocument({ data: dataUrlOrArrayBuffer });
    }

    const pdf = await loadingTask.promise;
    const totalPages = Math.min(pdf.numPages, maxPages);
    const pages: RenderedPdfPage[] = [];

    // Scale 1.5 to 2.0 provides sharp print resolution (approx 150-200 DPI)
    const scale = 1.6;

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Fill white background for printing
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: context,
        viewport,
      }).promise;

      pages.push({
        pageNumber: i,
        dataUrl: canvas.toDataURL('image/jpeg', 0.92),
        width: viewport.width,
        height: viewport.height,
      });
    }

    return pages;
  } catch (err) {
    console.warn('PDF rendering error:', err);
    throw err;
  }
}
