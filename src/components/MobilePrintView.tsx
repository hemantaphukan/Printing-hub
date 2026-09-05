import React, { useState, useEffect, useRef } from 'react';
import { PrintJob, PaperSize, PrintOrientation, PrintColorMode } from '../types';
import { PrintRenderer } from './PrintRenderer';
import { processUploadedFile, formatBytes, createSamplePdfJob } from '../utils/fileProcessor';
import {
  Printer,
  ArrowLeft,
  Settings2,
  FileCheck,
  RotateCw,
  Sparkles,
  Info,
  CheckCircle2,
  Share2,
  Upload,
  Camera,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  RefreshCw,
  Sliders,
  Check,
  AlertCircle
} from 'lucide-react';

interface MobilePrintViewProps {
  job: PrintJob;
  onBackToEditor: () => void;
  onUpdateJob?: (updated: PrintJob) => void;
}

export const MobilePrintView: React.FC<MobilePrintViewProps> = ({
  job,
  onBackToEditor,
  onUpdateJob,
}) => {
  const [currentJob, setCurrentJob] = useState<PrintJob>(job);
  const [showSettings, setShowSettings] = useState(false);
  const [showFilePickerModal, setShowFilePickerModal] = useState(
    job.id.includes('station') && !job.uploadedFile?.dataUrl && !job.document
  );
  const [hasTriggeredAuto, setHasTriggeredAuto] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(
    job.autoTrigger && !job.id.includes('station') ? 2 : null
  );
  const [printSuccessNotice, setPrintSuccessNotice] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Sync state if job prop updates
  useEffect(() => {
    setCurrentJob(job);
  }, [job]);

  // Handle auto-trigger countdown for smooth mobile UX
  useEffect(() => {
    if (!job.autoTrigger || hasTriggeredAuto || job.id.includes('station')) return;

    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setHasTriggeredAuto(true);
      triggerNativePrint();
    }
  }, [countdown, job.autoTrigger, hasTriggeredAuto, job.id]);

  const triggerNativePrint = () => {
    try {
      window.print();
      setPrintSuccessNotice(true);
      setTimeout(() => setPrintSuccessNotice(false), 5000);
    } catch (err) {
      console.warn('Native window.print() call failed:', err);
    }
  };

  const handleFileChange = async (file: File) => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setProcessingStatus(`Loading ${file.name}...`);

      const newJob = await processUploadedFile(file, (status) => {
        setProcessingStatus(status);
      });

      setCurrentJob(newJob);
      if (onUpdateJob) onUpdateJob(newJob);
      setShowFilePickerModal(false);
    } catch (err: any) {
      console.error('Failed to process mobile file:', err);
      setErrorMessage(err.message || 'Could not load file for printing');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handlePaperSizeChange = (size: PaperSize) => {
    const updated = { ...currentJob, paperSize: size };
    setCurrentJob(updated);
    if (onUpdateJob) onUpdateJob(updated);
  };

  const handleOrientationToggle = () => {
    const nextOrientation: PrintOrientation =
      currentJob.orientation === 'portrait' ? 'landscape' : 'portrait';
    const updated = { ...currentJob, orientation: nextOrientation };
    setCurrentJob(updated);
    if (onUpdateJob) onUpdateJob(updated);
  };

  const handleColorModeChange = (mode: PrintColorMode) => {
    const updated = { ...currentJob, colorMode: mode };
    setCurrentJob(updated);
    if (onUpdateJob) onUpdateJob(updated);
  };

  const fileData = currentJob.uploadedFile;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-32">
      {/* Hidden file inputs for mobile OS file picking and camera capture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileChange(f);
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileChange(f);
        }}
      />

      {/* Top Mobile Sticky Action Bar (Hidden during actual print) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs no-print">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            id="back-to-editor-btn"
            type="button"
            onClick={onBackToEditor}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Station &amp; QR</span>
            <span className="sm:hidden">Back</span>
          </button>

          <div className="text-center truncate px-2">
            <h1 className="text-sm font-bold text-slate-900 truncate">
              {currentJob.title || 'Direct Print Job'}
            </h1>
            <p className="text-[11px] text-emerald-600 font-medium">
              Native AirPrint &amp; Android Direct • Zero Downloads
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="mobile-open-picker-btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 p-2 sm:px-3 sm:py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition cursor-pointer"
              title="Select Any File"
            >
              <Upload className="w-4 h-4 text-slate-700" />
              <span className="hidden sm:inline">Change File</span>
            </button>

            <button
              id="toggle-print-settings-btn"
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                showSettings
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Print Adjustments"
              aria-label="Print Adjustments"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* File Processing Indicator */}
        {isProcessing && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold text-center flex items-center justify-center gap-2 animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>{processingStatus || 'Preparing file for printing...'}</span>
          </div>
        )}

        {/* Auto-print notification banner */}
        {countdown !== null && countdown > 0 && !hasTriggeredAuto && !isProcessing && (
          <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-medium text-center flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
            <span>Sending to native mobile printer in {countdown}s...</span>
            <button
              onClick={() => setCountdown(null)}
              className="underline font-bold text-[11px] ml-2 cursor-pointer"
            >
              Cancel auto-open
            </button>
          </div>
        )}

        {/* Success toast banner */}
        {printSuccessNotice && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-medium text-center flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>
              Print prompt sent to your mobile system spooler (AirPrint / Android Print Service).
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="bg-rose-600 text-white px-4 py-2 text-xs font-medium text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Expandable Print Format Controls */}
        {showSettings && (
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-4 text-xs animate-in fade-in slide-in-from-top-1">
            <div className="max-w-4xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Paper Size</label>
                <select
                  id="mobile-paper-size-select"
                  value={currentJob.paperSize}
                  onChange={(e) => handlePaperSizeChange(e.target.value as PaperSize)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 text-xs focus:ring-1 focus:ring-slate-900"
                >
                  <option value="letter">Letter (8.5 × 11")</option>
                  <option value="a4">A4 (210 × 297mm)</option>
                  <option value="label-4x6">4 × 6" Shipping Label</option>
                  <option value="receipt-80mm">80mm POS Thermal</option>
                  <option value="photo-4x6">4 × 6" Photo Paper</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Orientation</label>
                <button
                  type="button"
                  onClick={handleOrientationToggle}
                  className="w-full flex items-center justify-between bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-800 text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  <span className="capitalize">{currentJob.orientation}</span>
                  <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Color Mode</label>
                <select
                  id="mobile-color-mode-select"
                  value={currentJob.colorMode}
                  onChange={(e) => handleColorModeChange(e.target.value as PrintColorMode)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 text-xs focus:ring-1 focus:ring-slate-900"
                >
                  <option value="color">Full Color</option>
                  <option value="grayscale">Grayscale / B&amp;W</option>
                  <option value="high-contrast">High Contrast (Labels/Scans)</option>
                </select>
              </div>

              {/* Document Enhancer toggle for Camera Photos */}
              {fileData && fileData.category === 'image' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Document Scanner Mode</label>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = {
                        ...currentJob,
                        uploadedFile: {
                          ...fileData,
                          documentContrastFilter: !fileData.documentContrastFilter,
                        },
                      };
                      setCurrentJob(updated);
                      if (onUpdateJob) onUpdateJob(updated);
                    }}
                    className={`w-full py-1.5 px-3 rounded-lg border font-semibold text-xs transition cursor-pointer flex items-center justify-between ${
                      fileData.documentContrastFilter
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300'
                    }`}
                  >
                    <span>{fileData.documentContrastFilter ? 'Crisp B&W Enabled' : 'Color Mode'}</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Main Preview and Printable Area */}
      <main className="max-w-4xl mx-auto px-4 pt-4">
        {/* Mobile File Selection Quick Actions Bar (no-print) */}
        <div className="mb-4 p-4 bg-white border border-slate-200/90 rounded-2xl shadow-xs no-print space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-bold text-slate-900 text-sm block">
                {fileData?.fileName ? `Ready: ${fileData.fileName}` : 'Universal Mobile Print Station'}
              </span>
              <span className="text-xs text-slate-500">
                {fileData?.fileSize
                  ? `${formatBytes(fileData.fileSize)} • ${fileData.category.toUpperCase()}`
                  : 'Scan any QR to print any file from this phone without app downloads'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-amber-400" />
                <span>Choose Any File</span>
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-slate-500" />
                <span>Camera Scan</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const sample = createSamplePdfJob();
                  setCurrentJob(sample);
                  if (onUpdateJob) onUpdateJob(sample);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-[11px] font-semibold text-amber-900 transition cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>Sample PDF</span>
              </button>
            </div>
          </div>
        </div>

        {/* Paper Container */}
        <div
          id="printable-container"
          className="bg-white rounded-2xl shadow-md border border-slate-200/90 overflow-hidden mx-auto transition-all"
          style={{
            maxWidth:
              currentJob.paperSize === 'receipt-80mm'
                ? '400px'
                : currentJob.paperSize === 'label-4x6'
                ? '440px'
                : currentJob.orientation === 'landscape'
                ? '100%'
                : '760px',
          }}
        >
          <PrintRenderer job={currentJob} />
        </div>
      </main>

      {/* Fixed Bottom Mobile Print Bar (Hidden during @media print) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-4 shadow-lg no-print">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            id="mobile-print-now-btn"
            type="button"
            onClick={triggerNativePrint}
            className="flex-1 inline-flex items-center justify-center gap-2.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold py-3.5 px-6 rounded-2xl shadow-md transition cursor-pointer text-base"
          >
            <Printer className="w-5 h-5 text-amber-400" />
            <span>Send to Print</span>
          </button>

          <button
            id="mobile-share-link-btn"
            type="button"
            onClick={() => {
              if (navigator.share) {
                navigator
                  .share({
                    title: currentJob.title,
                    text: 'Direct Print Link - Scan and print directly without extra downloads',
                    url: window.location.href,
                  })
                  .catch(() => {});
              } else {
                navigator.clipboard.writeText(window.location.href);
                setPrintSuccessNotice(true);
                setTimeout(() => setPrintSuccessNotice(false), 2500);
              }
            }}
            className="p-3.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded-2xl transition cursor-pointer shrink-0"
            title="Share Print Link"
            aria-label="Share Print Link"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
