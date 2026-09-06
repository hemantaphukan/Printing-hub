import React, { useState, useRef, useEffect } from 'react';
import { PaperSize, PrintOrientation, PrintColorMode, StationConfig, BusinessPrintOrder, UploadedFileData } from '../types';
import {
  processUploadedFile,
  formatBytes,
  createSamplePdfJob,
  createDualSideImageJob,
  createSampleDualSideIdData,
  readFileAsDataUrl,
} from '../utils/fileProcessor';
import { submitCustomerOrder, formatCurrency } from '../utils/api';
import { p2pSync, ConnectionStatus } from '../utils/p2pSync';
import { getStationIdFromUrl } from '../utils/codec';
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
  RotateCcw,
  Wifi,
  Columns,
  Trash2,
  CreditCard,
} from 'lucide-react';

interface CustomerUploadPortalProps {
  stationConfig: StationConfig;
}

export const CustomerUploadPortal: React.FC<CustomerUploadPortalProps> = ({
  stationConfig: initialConfig,
}) => {
  const [liveConfig, setLiveConfig] = useState<StationConfig>(initialConfig);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [connectionMsg, setConnectionMsg] = useState<string>('');

  // Mode: Single file/PDF or Front & Back ID Card photos
  const [uploadMode, setUploadMode] = useState<'single' | 'front-back'>('single');
  const [frontImage, setFrontImage] = useState<{ dataUrl: string; fileName: string; fileSize: number } | null>(null);
  const [backImage, setBackImage] = useState<{ dataUrl: string; fileName: string; fileSize: number } | null>(null);
  const [dualLayout, setDualLayout] = useState<'stacked-1page' | 'side-by-side-1page' | 'separate-2pages'>('stacked-1page');

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
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const frontCameraRef = useRef<HTMLInputElement>(null);
  const backFileInputRef = useRef<HTMLInputElement>(null);
  const backCameraRef = useRef<HTMLInputElement>(null);

  // Cost calculation
  const pageCount = selectedFile?.pageCount || 1;
  const bwRate =
    typeof liveConfig?.pricePerBwPage === 'number' && !isNaN(liveConfig.pricePerBwPage)
      ? liveConfig.pricePerBwPage
      : 10;
  const colorRate =
    typeof liveConfig?.pricePerColorPage === 'number' && !isNaN(liveConfig.pricePerColorPage)
      ? liveConfig.pricePerColorPage
      : 10;
  const unitRate = colorMode === 'color' ? colorRate : bwRate;
  const estimatedTotal = parseFloat(((pageCount * (copies || 1) * unitRate) || 0).toFixed(2));

  // Initialize P2P connection to Shop Owner PC Station
  useEffect(() => {
    const stationId = getStationIdFromUrl() || liveConfig.stationId || 'counter-main';

    p2pSync.connectClient(
      stationId,
      (status, msg) => {
        setConnectionStatus(status);
        if (msg) setConnectionMsg(msg);
      },
      (remoteConfig) => {
        if (remoteConfig) {
          setLiveConfig((prev) => ({ ...prev, ...remoteConfig }));
        }
      },
      (orderId, updatedStatus) => {
        if (submittedOrder && submittedOrder.id === orderId) {
          setOrderStatus(updatedStatus);
        }
      }
    );

    return () => {
      // client keeps connection until tab closes
    };
  }, [submittedOrder]);

  // Poll order status if submitted (backup fallback)
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
        // Netlify static mode, P2P handles status updates
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
      setUploadMode('single');
    }
  };

  const handleSideImageSelect = async (file: File, side: 'front' | 'back') => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setProcessingStatus(`Loading ${side === 'front' ? 'Front Side' : 'Back Side'} photo...`);

      const dataUrl = await readFileAsDataUrl(file);
      const sideData = {
        dataUrl,
        fileName: file.name,
        fileSize: file.size,
      };

      const newFront = side === 'front' ? sideData : frontImage;
      const newBack = side === 'back' ? sideData : backImage;

      if (side === 'front') setFrontImage(sideData);
      if (side === 'back') setBackImage(sideData);

      if (newFront && newBack) {
        const dualJob = createDualSideImageJob(
          newFront,
          newBack,
          dualLayout,
          selectedFile?.documentContrastFilter || false
        );
        setSelectedFile(dualJob);
      } else if (side === 'front') {
        setSelectedFile({
          fileName: `Front_Side_${file.name}`,
          fileSize: file.size,
          mimeType: file.type || 'image/jpeg',
          category: 'image',
          dataUrl,
          pageCount: 1,
        });
      } else if (side === 'back') {
        setSelectedFile({
          fileName: `Back_Side_${file.name}`,
          fileSize: file.size,
          mimeType: file.type || 'image/jpeg',
          category: 'image',
          dataUrl,
          pageCount: 1,
        });
      }
    } catch (err: any) {
      console.error('Error loading side image:', err);
      setErrorMessage('Failed to read image file. Please try another photo or format.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleDualLayoutChange = (layout: 'stacked-1page' | 'side-by-side-1page' | 'separate-2pages') => {
    setDualLayout(layout);
    if (frontImage && backImage) {
      const dualJob = createDualSideImageJob(
        frontImage,
        backImage,
        layout,
        selectedFile?.documentContrastFilter || false
      );
      setSelectedFile(dualJob);
    }
  };

  const handleRemoveSide = (side: 'front' | 'back') => {
    if (side === 'front') {
      setFrontImage(null);
      if (backImage) {
        setSelectedFile({
          fileName: `Back_Side_${backImage.fileName}`,
          fileSize: backImage.fileSize,
          mimeType: 'image/jpeg',
          category: 'image',
          dataUrl: backImage.dataUrl,
          pageCount: 1,
        });
      } else {
        setSelectedFile(null);
      }
    } else {
      setBackImage(null);
      if (frontImage) {
        setSelectedFile({
          fileName: `Front_Side_${frontImage.fileName}`,
          fileSize: frontImage.fileSize,
          mimeType: 'image/jpeg',
          category: 'image',
          dataUrl: frontImage.dataUrl,
          pageCount: 1,
        });
      } else {
        setSelectedFile(null);
      }
    }
  };

  const handleLoadSampleDualSide = () => {
    const sample = createSampleDualSideIdData(dualLayout);
    setFrontImage(sample.front);
    setBackImage(sample.back);
    const dualJob = createDualSideImageJob(sample.front, sample.back, dualLayout, true);
    setSelectedFile(dualJob);
    setUploadMode('front-back');
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadMode === 'front-back') {
      if (!frontImage || !backImage) {
        setErrorMessage('Please upload both Front and Back images for 2-sided ID printing.');
        return;
      }
    } else if (!selectedFile) {
      setErrorMessage('Please choose or photograph a file to print.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const result = await submitCustomerOrder({
        customerName,
        customerPhone,
        fileData: selectedFile!,
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
    setFrontImage(null);
    setBackImage(null);
    setSubmittedOrder(null);
    setCustomerNotes('');
    setCopies(1);
    setPageRange('All');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20">
      {/* Hidden file & camera inputs for Single Mode */}
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

      {/* Hidden inputs for Front & Back Dual-Side Mode */}
      <input
        ref={frontFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleSideImageSelect(file, 'front');
        }}
      />
      <input
        ref={frontCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleSideImageSelect(file, 'front');
        }}
      />
      <input
        ref={backFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleSideImageSelect(file, 'back');
        }}
      />
      <input
        ref={backCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleSideImageSelect(file, 'back');
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
                {liveConfig.shopName}
              </h1>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Store className="w-3 h-3 text-amber-400" />
                <span>Instant Counter Printing • Direct to PC</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>No Login Needed</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-800 text-slate-300 border border-slate-700 text-[11px] px-2.5 py-1 rounded-full">
              <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{connectionStatus === 'connected' ? 'Connected to Shop PC' : 'Linking...'}</span>
            </div>
          </div>
        </div>

        {/* Pricing Ribbon */}
        <div className="bg-slate-800 border-t border-slate-700/80 px-4 py-2 text-xs">
          <div className="max-w-2xl mx-auto flex items-center justify-between text-slate-300">
            <span className="font-medium text-[11px] text-amber-300">Live Counter Rates:</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span>
                Black &amp; White:{' '}
                <strong className="text-white">
                  {formatCurrency(bwRate, liveConfig?.currency)}
                </strong>
                /pg
              </span>
              <span>•</span>
              <span>
                Full Color:{' '}
                <strong className="text-emerald-400">
                  {formatCurrency(colorRate, liveConfig?.currency)}
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
                  {formatCurrency((submittedOrder.estimatedPrice ?? estimatedTotal) || 0, liveConfig?.currency)}
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
                  <h2 className="text-sm font-bold text-slate-900">Select Document or ID Photos</h2>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Instant Guest Access • No Login
                </span>
              </div>

              {/* Upload Mode Selector Pills */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('single');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    uploadMode === 'single'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="w-4 h-4 text-rose-500" />
                  <span>Single File / PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUploadMode('front-back');
                    if (frontImage && backImage) {
                      const dualJob = createDualSideImageJob(
                        frontImage,
                        backImage,
                        dualLayout,
                        selectedFile?.documentContrastFilter || false
                      );
                      setSelectedFile(dualJob);
                    }
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    uploadMode === 'front-back'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-blue-600" />
                  <span>Front &amp; Back (ID Card)</span>
                </button>
              </div>

              {/* MODE 1: SINGLE DOCUMENT / PDF */}
              {uploadMode === 'single' && (
                <div className="space-y-4">
                  {/* Upload Drop Box */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition cursor-pointer ${
                      selectedFile && !selectedFile.isDualSideId
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
                    ) : selectedFile && !selectedFile.isDualSideId ? (
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
                            Direct to connected shop printer • No account or login needed
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
                </div>
              )}

              {/* MODE 2: FRONT & BACK IMAGE UPLOAD (ID Card / License / 2-Sided Photo) */}
              {uploadMode === 'front-back' && (
                <div className="space-y-4">
                  {/* Informational Guidance Banner */}
                  <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-blue-950">
                    <CreditCard className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold">2-Sided ID &amp; Document Scanning:</strong> Upload or snap a photo of the <strong>Front Side</strong> and the <strong>Back Side</strong>. Both will be neatly combined onto the paper for print.
                    </div>
                  </div>

                  {/* 2 Upload Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* FRONT IMAGE CARD */}
                    <div
                      className={`p-4 rounded-2xl border-2 transition ${
                        frontImage ? 'border-blue-500 bg-blue-50/20' : 'border-dashed border-slate-300 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-600 text-white tracking-wide uppercase">
                          Front Side
                        </span>
                        {frontImage && (
                          <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                          </span>
                        )}
                      </div>

                      {frontImage ? (
                        <div className="space-y-3">
                          <div className="w-full h-36 bg-slate-900/5 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center p-1">
                            <img
                              src={frontImage.dataUrl}
                              alt="Front Side Thumbnail"
                              className="max-h-full max-w-full object-contain rounded-lg shadow-2xs"
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate max-w-[150px] font-semibold text-slate-800">
                              {frontImage.fileName}
                            </span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              {formatBytes(frontImage.fileSize)}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => frontFileInputRef.current?.click()}
                              className="flex-1 py-1.5 px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              onClick={() => frontCameraRef.current?.click()}
                              className="p-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                              title="Retake Front Side with camera"
                            >
                              <Camera className="w-4 h-4 text-slate-600" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSide('front')}
                              className="p-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                              title="Remove front image"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">Front Image Upload</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Select photo or use camera</p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => frontFileInputRef.current?.click()}
                              className="flex-1 py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Select Front</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => frontCameraRef.current?.click()}
                              className="py-2 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-slate-600" />
                              <span>Camera</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BACK IMAGE CARD */}
                    <div
                      className={`p-4 rounded-2xl border-2 transition ${
                        backImage ? 'border-emerald-500 bg-emerald-50/20' : 'border-dashed border-slate-300 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white tracking-wide uppercase">
                          Back Side
                        </span>
                        {backImage && (
                          <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                          </span>
                        )}
                      </div>

                      {backImage ? (
                        <div className="space-y-3">
                          <div className="w-full h-36 bg-slate-900/5 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center p-1">
                            <img
                              src={backImage.dataUrl}
                              alt="Back Side Thumbnail"
                              className="max-h-full max-w-full object-contain rounded-lg shadow-2xs"
                            />
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate max-w-[150px] font-semibold text-slate-800">
                              {backImage.fileName}
                            </span>
                            <span className="text-slate-400 font-mono text-[10px]">
                              {formatBytes(backImage.fileSize)}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => backFileInputRef.current?.click()}
                              className="flex-1 py-1.5 px-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                            >
                              Replace
                            </button>
                            <button
                              type="button"
                              onClick={() => backCameraRef.current?.click()}
                              className="p-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                              title="Retake Back Side with camera"
                            >
                              <Camera className="w-4 h-4 text-slate-600" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSide('back')}
                              className="p-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition cursor-pointer"
                              title="Remove back image"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center space-y-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">Back Image Upload</h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">Select photo or use camera</p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => backFileInputRef.current?.click()}
                              className="flex-1 py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Select Back</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => backCameraRef.current?.click()}
                              className="py-2 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5 text-slate-600" />
                              <span>Camera</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Print Layout Selection for Front & Back */}
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      Print Layout Arrangement on Paper:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleDualLayoutChange('stacked-1page')}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                          dualLayout === 'stacked-1page'
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-amber-400" />
                          <span>Stacked (1 Page)</span>
                        </div>
                        <p className={`text-[10px] mt-1 ${dualLayout === 'stacked-1page' ? 'text-slate-300' : 'text-slate-500'}`}>
                          Top &amp; Bottom on single sheet • Standard ID copy
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDualLayoutChange('side-by-side-1page')}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                          dualLayout === 'side-by-side-1page'
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          <Columns className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Side-by-Side (1 Page)</span>
                        </div>
                        <p className={`text-[10px] mt-1 ${dualLayout === 'side-by-side-1page' ? 'text-slate-300' : 'text-slate-500'}`}>
                          Left &amp; Right horizontally • 1 page rate
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDualLayoutChange('separate-2pages')}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                          dualLayout === 'separate-2pages'
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          <span>2 Pages (Back-to-Back)</span>
                        </div>
                        <p className={`text-[10px] mt-1 ${dualLayout === 'separate-2pages' ? 'text-slate-300' : 'text-slate-500'}`}>
                          Full page each / Duplex • 2 page rate
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Quick actions for Front & Back mode */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <button
                      type="button"
                      onClick={handleLoadSampleDualSide}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 font-semibold text-indigo-900 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Test Sample Driver's License (Front &amp; Back)</span>
                    </button>

                    {frontImage && backImage && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Both Sides Connected
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Optional contrast enhancement for photographed receipts/documents */}
              {selectedFile && (selectedFile.category === 'image' || selectedFile.isDualSideId) && (
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={selectedFile.documentContrastFilter || false}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      if (uploadMode === 'front-back' && frontImage && backImage) {
                        const dualJob = createDualSideImageJob(frontImage, backImage, dualLayout, enabled);
                        setSelectedFile(dualJob);
                      } else {
                        setSelectedFile({
                          ...selectedFile,
                          documentContrastFilter: enabled,
                        });
                      }
                    }}
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
                      {formatCurrency(bwRate, liveConfig?.currency)} per page
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
                      {formatCurrency(colorRate, liveConfig?.currency)} per page
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
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-black">
                    3
                  </span>
                  <h2 className="text-sm font-bold text-slate-900">Pickup Tag &amp; Instructions</h2>
                </div>
                <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  Optional • No Account Needed
                </span>
              </div>

              <p className="text-xs text-slate-500 -mt-1">
                You can print instantly as a guest without creating an account or logging in. Just provide an optional name or nickname so the clerk can hand you your paper.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Your Name or Nickname (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Guest / John"
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
                    {formatCurrency(estimatedTotal || 0, liveConfig?.currency)}
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
