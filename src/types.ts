export type PrintJobType =
  | 'uploaded-file'
  | 'document'
  | 'receipt'
  | 'label'
  | 'ticket'
  | 'photo'
  | 'note'
  | 'webpage';

export type PaperSize = 'letter' | 'a4' | 'label-4x6' | 'receipt-80mm' | 'photo-4x6';

export type PrintOrientation = 'portrait' | 'landscape';

export type PrintColorMode = 'color' | 'grayscale' | 'high-contrast';

export type PrintJobStatus = 'queued' | 'printing' | 'completed' | 'cancelled';

export interface BusinessPrintOrder {
  id: string;
  ticketNumber: string; // e.g. #A-101
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  fileData: UploadedFileData;
  paperSize: PaperSize;
  orientation: PrintOrientation;
  colorMode: PrintColorMode;
  copies: number;
  pageRange?: string; // e.g. "All" or "1-3"
  doubleSided?: boolean;
  customerNotes?: string;
  status: PrintJobStatus;
  estimatedPrice: number;
  isPaid: boolean;
  printedAt?: string;
  autoPrinted?: boolean;
}

export interface StationConfig {
  stationId?: string; // WebRTC P2P station identifier for Netlify static deployment
  shopName: string;
  shopSubtitle?: string;
  shopPhone?: string;
  shopAddress?: string;
  currency: string;
  pricePerBwPage: number;
  pricePerColorPage: number;
  autoPrintEnabled: boolean;
  autoPrintDelaySeconds: number; // 0 for instant, or 3 for safety chime countdown
  soundAlertEnabled: boolean;
  allowCustomerUploads: boolean;
  autoPrintMaxPages?: number; // Safety threshold (e.g. 15 pages max)
  autoPrintColorAllowed?: boolean; // If false, color prints hold for confirmation
  autoPrintRequirePaid?: boolean; // If true, only auto-print paid orders
  targetPrinterName?: string; // e.g. "Default Laser Printer"
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  type: 'info' | 'print' | 'warn' | 'success' | 'skip';
  message: string;
  ticketNumber?: string;
}

export interface UploadedFileData {
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: 'pdf' | 'image' | 'text' | 'document' | 'other';
  dataUrl?: string; // base64 or object URL
  textPreview?: string;
  pageCount?: number;
  pdfPages?: { pageNumber: number; dataUrl: string; width: number; height: number }[];
  imageFit?: 'fit-page' | 'original' | '2-up' | 'full-bleed';
  documentContrastFilter?: boolean; // Enhanced high-contrast B&W for document scans
  showPageNumbers?: boolean;
  isDualSideId?: boolean; // Front & Back image mode
  frontImage?: { dataUrl: string; fileName: string; fileSize: number };
  backImage?: { dataUrl: string; fileName: string; fileSize: number };
  dualLayout?: 'stacked-1page' | 'side-by-side-1page' | 'separate-2pages';
}

export interface ReceiptItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

export interface PrintJob {
  id: string;
  title: string;
  createdAt: string;
  type: PrintJobType;
  paperSize: PaperSize;
  orientation: PrintOrientation;
  colorMode: PrintColorMode;
  autoTrigger: boolean;
  fontScale: 'sm' | 'md' | 'lg';
  
  // Custom Any File Uploaded
  uploadedFile?: UploadedFileData;
  
  // Document type
  document?: {
    header: string;
    subtitle?: string;
    author?: string;
    date?: string;
    content: string;
    showSignatureLine: boolean;
    signatureLabel?: string;
  };

  // Receipt type
  receipt?: {
    merchantName: string;
    merchantAddress?: string;
    merchantPhone?: string;
    receiptNumber: string;
    date: string;
    items: ReceiptItem[];
    taxPercent: number;
    tipAmount?: number;
    paymentMethod: string;
    barcodeValue: string;
    footerNote: string;
  };

  // Shipping / Address Label
  label?: {
    carrier: string;
    serviceType: string;
    trackingNumber: string;
    senderName: string;
    senderAddress: string;
    recipientName: string;
    recipientAddress: string;
    weight?: string;
    notes?: string;
    packageType?: string;
  };

  // Ticket / Pass
  ticket?: {
    eventName: string;
    venue: string;
    date: string;
    time: string;
    gate?: string;
    section?: string;
    seat?: string;
    ticketHolder: string;
    ticketType: string;
    barcodeValue: string;
    admissionNote?: string;
  };

  // Photo
  photo?: {
    imageUrl: string;
    caption?: string;
    aspectRatio: 'standard' | 'square' | 'portrait';
    fitMode: 'fit' | 'fill';
    borderStyle: 'none' | 'thin-white' | 'polaroid';
  };

  // Quick Note
  note?: {
    heading: string;
    body: string;
    isChecklist?: boolean;
    checklistItems?: { id: string; text: string; done: boolean }[];
  };

  // Webpage / Article Link
  webpage?: {
    url: string;
    pageTitle: string;
    sourceDomain: string;
    summary: string;
    keyPoints: string[];
  };
}
