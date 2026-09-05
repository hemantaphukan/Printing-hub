import React, { useState, useRef, useEffect } from 'react';
import { PaperSize, PrintOrientation, PrintColorMode, StationConfig, BusinessPrintOrder, UploadedFileData } from '../types';
import { processUploadedFile, formatBytes, createSamplePdfJob } from '../utils/fileProcessor';
import { submitCustomerOrder } from '../utils/api';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Camera,
  Sparkles,
  CheckCircle2,
  Printer,
  RefreshCw,
  AlertCircle,
  Clock,
  Check,
  ChevronRight,
  ShieldCheck,
  Phone,
  Store,
  Layers,
  HelpCircle,
  RotateCcw
} from 'lucide-react';

interface CustomerUploadPortalProps {
  stationConfig: StationConfig;
  onSwitchToShopMode?: () => void;
}

export const CustomerUploadPortal: React.FC<CustomerUploadPortalProps> = ({
  stationConfig,
  onSwitchToShopMode,
}) => {
  // File state
  const [selectedFile, setSelectedFile] = useState<UploadedFileData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Print preferences
  const [colorMode, setColorMode] = useState<PrintColorMode>('grayscale');
  const [copies, setCopies] = useState<number>(1);
  const [paperSize, setPaperSize] = useState<PaperSize>('letter');
  const [orientation, setOrientation] = useState<PrintOrientation>('portrait');
  const [pageRange, setPageRange] = useState<string>('All');
  const [doubleSided, setDoubleSided] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<BusinessPrintOrder | null>(null);
  const [orderStatus, setOrderStatus] = useState<'queued' | 'printing' | 'completed' | 'cancelled'>('queued');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Cost calculation
  const pageCount = selectedFile?.pageCount || 1;
  const unitRate = colorMode === 'color' ? stationConfig.pricePerColorPage : stationConfig.pricePerBwPage;
  const estimatedTotal = parseFloat((pageCount * copies * unitRate).toFixed(2));

  // Poll order status if submitted
  useEffect(() => {
    if (!submittedOrder) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders`);
        if (res.ok) {
          const allOrders: BusinessPrintOrder[] = await res.json();
          const found = allOrders.find((o) => o.id === submittedOrder.id);
          if (found) {
            setOrderStatus(found.status);
            if (found.status === 'completed') {
              clearInterval(interval);
            }
          }
        }
      } catch (err) {
        console.warn('Status poll error:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [submittedOrder]);

  const handleFileSelect = async (file: File) => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setProcessingStatus(`Analyzing ${file.name}...`);

      const newJob = await processUploadedFile(file, (status) => {
        setProcessingStatus(status);
      });

      if (newJob.uploadedFile) {
        setSelectedFile(newJob.uploadedFile);
        // Default orientation from analysis
        setOrientation(newJob.orientation);
      }
    } catch (err: any) {
      console.error('File processing error:', err);
      setErrorMessage(err.message || 'Could not process file. Please try another file or format.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleLoadSamplePdf = () => {
    const sample = createSamplePdfJob();
    if (sample.uploadedFile) {
      setSelectedFile(sample.uploadedFile);
      setOrientation(sample.orientation);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please choose or photograph a file to print.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const result = await submitCustomerOrder({
        customerName,
        customerPhone,
        fileData: selectedFile,
        paperSize,
        orientation,
        colorMode,
        copies,
        pageRange,
        doubleSided,
        customerNotes,
      });

      setSubmittedOrder(result.order);
      setOrderStatus(result.order.status);
    } catch (err: any) {
      console.error('Submission failed:', err);
      setErrorMessage(err.message || 'Failed to send print job to the shop counter. Please inform the shopkeeper.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNewOrder = () => {
    setSelectedFile(null);
    setSubmittedOrder(null);
    setCustomerNotes('');
    setCopies(1);
    setPageRange('All');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20">
      {/* Hidden file & camera inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />

      {/* Header Banner */}
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                {stationConfig.shopName}
              </h1>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Store className="w-3 h-3 text-amber-400" />
                <span>Instant Counter Printing • Direct to PC</span>
              </p>
            </div>
          </div>

          {onSwitchToShopMode && (
            <button
              type="button"
              onClick={onSwitchToShopMode}
              className="text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg transition cursor-pointer border border-slate-700"
            >
              Shop PC View
            </button>
          )}
        </div>

        {/* Pricing Ribbon */}
        <div className="bg-slate-800 border-t border-slate-700/80 px-4 py-2 text-xs">
          <div className="max-w-2xl mx-auto flex items-center justify-between text-slate-300">
            <span className="font-medium text-[11px] text-amber-300">Live Counter Rates:</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span>
                Black &amp; White:{' '}
                <strong className="text-white">
                  {stationConfig.currency}
                  {stationConfig.pricePerBwPage.toFixed(2)}
                </strong>
                /pg
              </span>
              <span>•</span>
              <span>
                Full Color:{' '}
                <strong className="text-emerald-400">
                  {stationConfig.currency}
                  {stationConfig.pricePerColorPage.toFixed(2)}
                </strong>
                /pg
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-6 space-y-6">
        {/* SUBMITTED CONFIRMATION SCREEN */}
        {submittedOrder ? (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-lg text-center space-y-6 animate-in fade-in zoom-in-95">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 mx-auto shadow-xs">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 mb-2">
                Order Sent to Connected Printer
              </span>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                Ticket {submittedOrder.ticketNumber}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Your file has been transferred to the shop counter PC. Please keep this screen open.
              </p>
            </div>

            {/* Live Status Tracker */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-2 border-b border-slate-200">
                <span>Print Progress:</span>
                <span className="capitalize font-mono text-slate-900">
                  {orderStatus === 'queued' && '⏳ Waiting in Queue'}
                  {orderStatus === 'printing' && '🖨️ Printing Now on PC'}
                  {orderStatus === 'completed' && '✅ Completed / Printed'}
                  {orderStatus === 'cancelled' && '❌ Cancelled'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold pt-1">
                <div
                  className={`p-2 rounded-xl transition ${
                    orderStatus === 'queued' || orderStatus === 'printing' || orderStatus === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  1. Sent to PC
                </div>
                <div
                  className={`p-2 rounded-xl transition ${
                    orderStatus === 'printing' || orderStatus === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs animate-pulse'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  2. Spooling Print
                </div>
                <div
                  className={`p-2 rounded-xl transition ${
                    orderStatus === 'completed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  3. Ready at Counter
                </div>
              </div>

              {orderStatus === 'completed' ? (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium text-center">
                  🎉 Your document has printed successfully! Please collect your paper at the counter.
                </div>
              ) : (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
                  <span>Shop PC is auto-reading and printing your file...</span>
                </div>
              )}
            </div>

            {/* Order Details Breakdown */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left text-xs space-y-2 text-slate-600">
              <div className="flex justify-between font-semibold text-slate-800">
                <span>File Name:</span>
                <span className="truncate max-w-[200px]">{submittedOrder.fileData.fileName}</span>
              </div>
              <div className="flex justify-between">
                <span>Pages &amp; Copies:</span>
                <span>
                  {submittedOrder.fileData.pageCount || 1} pages × {submittedOrder.copies} {submittedOrder.copies === 1 ? 'copy' : 'copies'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Print Mode:</span>
                <span className="capitalize font-semibold text-slate-900">
                  {submittedOrder.colorMode === 'color' ? 'Full Color' : 'Black & White'}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-sm text-slate-900">
                <span>Total Due at Counter:</span>
                <span className="text-emerald-700">
                  {stationConfig.currency}
                  {submittedOrder.estimatedPrice.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetForNewOrder}
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Upload Another Document</span>
            </button>
          </div>
        ) : (
          /* ACTIVE UPLOAD & ORDER CREATION FORM */
          <form onSubmit={handleSubmitOrder} className="space-y-6">
            {/* Step 1: File Selection Area */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                    1
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">Select Image or PDF to Print</h2>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  All Formats Supported
                </span>
              </div>

              {/* Upload Drop Box */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
                  selectedFile
                    ? 'border-emerald-500 bg-emerald-50/30'
                    : 'border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100/70'
                }`}
              >
                {isProcessing ? (
                  <div className="py-6 space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mx-auto" />
                    <p className="text-xs font-semibold text-slate-800">
                      {processingStatus || 'Preparing file for shop printer...'}
                    </p>
                  </div>
                ) : selectedFile ? (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-xs">
                      {selectedFile.category === 'pdf' ? (
                        <FileText className="w-6 h-6" />
                      ) : (
                        <ImageIcon className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 truncate max-w-sm mx-auto">
                        {selectedFile.fileName}
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatBytes(selectedFile.fileSize)} •{' '}
                        {selectedFile.pageCount && `${selectedFile.pageCount} ${selectedFile.pageCount === 1 ? 'Page' : 'Pages'}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="text-xs font-bold text-emerald-700 underline cursor-pointer"
                    >
                      Tap to replace file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 py-3">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center mx-auto shadow-2xs">
                      <Upload className="w-6 h-6 text-slate-800" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Tap here to select PDF or Photo
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Files are directly sent to the shop owner's connected printer
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick actions: Camera & Sample PDF */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 transition cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-slate-600" />
                  <span>Snap Document with Camera</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSamplePdf}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 font-semibold text-amber-900 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Test Sample Boarding Pass PDF</span>
                </button>
              </div>

              {/* Optional contrast enhancement for photographed receipts/documents */}
              {selectedFile && selectedFile.category === 'image' && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={selectedFile.documentContrastFilter || false}
                    onChange={(e) =>
                      setSelectedFile({
                        ...selectedFile,
                        documentContrastFilter: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="font-semibold text-slate-900 block">
                      Enhance Document Contrast (Scanner Mode)
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      Removes desk shadows and turns phone photos into crisp black-and-white printouts.
                    </span>
                  </div>
                </label>
              )}
            </div>

            {/* Step 2: Print Settings & Preferences */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                  2
                </span>
                <h2 className="text-sm font-bold text-slate-900">Print Options &amp; Paper</h2>
              </div>

              {/* Color Mode Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Color Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setColorMode('grayscale')}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                      colorMode === 'grayscale'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="font-bold text-xs">Black &amp; White</div>
                    <div
                      className={`text-xs mt-0.5 ${
                        colorMode === 'grayscale' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {stationConfig.currency}
                      {stationConfig.pricePerBwPage.toFixed(2)} per page
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setColorMode('color')}
                    className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                      colorMode === 'color'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="font-bold text-xs flex items-center gap-1.5">
                      <span>Full Color</span>
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                    </div>
                    <div
                      className={`text-xs mt-0.5 ${
                        colorMode === 'color' ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {stationConfig.currency}
                      {stationConfig.pricePerColorPage.toFixed(2)} per page
                    </div>
                  </button>
                </div>
              </div>

              {/* Number of Copies */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Number of Copies
                  </label>
                  <div className="flex items-center bg-slate-50 border border-slate-300 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setCopies(Math.max(1, copies - 1))}
                      className="w-8 h-8 rounded-lg bg-white shadow-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-bold text-sm text-slate-900 font-mono">
                      {copies}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCopies(copies + 1)}
                      className="w-8 h-8 rounded-lg bg-white shadow-xs font-bold text-slate-800 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Paper Size</label>
                  <select
                    value={paperSize}
                    onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="letter">Letter (8.5 × 11")</option>
                    <option value="a4">A4 (210 × 297mm)</option>
                    <option value="photo-4x6">4 × 6" Photo Paper</option>
                    <option value="label-4x6">4 × 6" Label</option>
                  </select>
                </div>
              </div>

              {/* Page Range & Duplex */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Page Range</label>
                  <input
                    type="text"
                    value={pageRange}
                    onChange={(e) => setPageRange(e.target.value)}
                    placeholder="All (or e.g. 1-3)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2 cursor-pointer mt-5">
                    <input
                      type="checkbox"
                      checked={doubleSided}
                      onChange={(e) => setDoubleSided(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Double-sided (Duplex)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Step 3: Customer Information & Instructions */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                  3
                </span>
                <h2 className="text-sm font-bold text-slate-900">Your Details (For Pickup)</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Your Name / Token
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. John D."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone / Mobile (Optional)
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 555-0199"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Special Instructions for Shopkeeper (Optional)
                </label>
                <input
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="e.g. Please staple top left corner, glossy paper, etc."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-medium">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Summary & Sticky Submit Bar */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 block">Total Estimated Cost</span>
                  <div className="text-2xl font-black text-slate-900">
                    {stationConfig.currency}
                    {estimatedTotal.toFixed(2)}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <span>
                    {pageCount} {pageCount === 1 ? 'page' : 'pages'} × {copies} {copies === 1 ? 'copy' : 'copies'}
                  </span>
                  <span className="block font-semibold text-slate-700">
                    {colorMode === 'color' ? 'Full Color' : 'B&W'} Rate
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !selectedFile}
                className={`w-full py-4 px-6 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-md transition cursor-pointer ${
                  isSubmitting || !selectedFile
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 active:scale-98 text-white'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
                    <span>Transmitting to Shop Printer...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-5 h-5 text-amber-400" />
                    <span>Send to Shop Printer 🖨️</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-slate-500 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Commands are read instantly by the connected shop PC. Pay at counter.</span>
              </p>
            </div>
          </form>
        )}
      </main>
    </div>
  );
};
