import React, { useState, useEffect } from 'react';
import { PrintJob } from '../types';
import { buildPrintUrl, buildStationUrl, generateQrDataUrl } from '../utils/codec';
import {
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Download,
  Smartphone,
  Printer,
  Sparkles,
  Wifi,
  Apple,
  FileText,
  UploadCloud,
  FileBox
} from 'lucide-react';

interface QRSharePanelProps {
  job: PrintJob;
  onOpenMobileView?: () => void;
}

export const QRSharePanel: React.FC<QRSharePanelProps> = ({ job, onOpenMobileView }) => {
  // Toggle between Universal Station QR (anyone prints any file) and Specific Job QR
  const [qrMode, setQrMode] = useState<'station' | 'job'>('station');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [shareUrl, setShareUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const generate = async () => {
      setIsGenerating(true);
      const url = qrMode === 'station' ? buildStationUrl() : buildPrintUrl(job);
      if (isMounted) {
        setShareUrl(url);
      }
      const dataUrl = await generateQrDataUrl(url, 2, 420);
      if (isMounted) {
        setQrDataUrl(dataUrl);
        setIsGenerating(false);
      }
    };

    generate();
    return () => {
      isMounted = false;
    };
  }, [job, qrMode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Failed to copy using clipboard API:', err);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `print-qr-${qrMode === 'station' ? 'universal-station' : job.type}-${Date.now()}.png`;
    a.click();
  };

  return (
    <div id="qr-share-panel" className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
      {/* Station vs Current Job Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80">
        <button
          type="button"
          onClick={() => setQrMode('station')}
          className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
            qrMode === 'station'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <UploadCloud className="w-4 h-4 text-amber-400" />
          <span>Universal Station (Anyone Can Print Any File)</span>
        </button>

        <button
          type="button"
          onClick={() => setQrMode('job')}
          className={`flex-1 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-bold transition cursor-pointer ${
            qrMode === 'job'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          <FileBox className="w-4 h-4 text-emerald-400" />
          <span>This Preset File: {job.title ? job.title.slice(0, 24) : job.type}</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start pt-2">
        {/* QR Code Presentation Box */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative p-4 bg-white border-2 border-slate-900 rounded-2xl shadow-sm group">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Scan to Print QR Code"
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-lg"
              />
            ) : (
              <div className="w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center bg-slate-50 rounded-lg text-slate-400">
                <QrCode className="w-12 h-12 animate-pulse" />
              </div>
            )}

            {/* Corner Scan Accent Marks */}
            <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-slate-800 rounded-tl-sm pointer-events-none" />
            <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-slate-800 rounded-tr-sm pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-slate-800 rounded-bl-sm pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-slate-800 rounded-br-sm pointer-events-none" />
          </div>

          <div className="flex items-center gap-2 mt-3 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>
              {qrMode === 'station' ? 'Scan to Print Any File' : 'Ready to Print Active Job'}
            </span>
          </div>

          <div className="flex gap-2 mt-4 w-full">
            <button
              id="download-qr-btn"
              type="button"
              onClick={handleDownloadQr}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 rounded-xl transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Save QR</span>
            </button>
            <button
              id="test-mobile-btn"
              type="button"
              onClick={onOpenMobileView}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-900 bg-amber-100 hover:bg-amber-200/90 border border-amber-300 rounded-xl transition cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-900" />
              <span>Mobile View</span>
            </button>
          </div>
        </div>

        {/* Instructions & Features */}
        <div className="flex-1 space-y-5 text-left w-full">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-semibold mb-2">
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              Zero App Downloads Required
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {qrMode === 'station'
                ? 'Scan QR to Print Any File from Mobile'
                : 'Scan QR to Print Active Document'}
            </h3>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
              {qrMode === 'station'
                ? 'Anyone with an iPhone or Android phone can scan this QR code. Their mobile browser opens immediately, letting them pick any PDF, photo, document, or camera scan to print directly with AirPrint / Android Print Service.'
                : 'Open your iPhone or Android default Camera app, point it at this QR code, and tap the banner. It opens directly in Safari or Chrome and triggers native printing.'}
            </p>
          </div>

          {/* Quick Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Scan with Camera</span>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                Standard built-in phone camera. No 3rd party scanner needed.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
                <span>Select Any File</span>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                Pick any PDF, photo, document, or snap a camera scan.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-1">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">3</span>
                <span>Send to Print</span>
              </div>
              <p className="text-xs text-slate-500 leading-normal">
                Sends to AirPrint, Wi-Fi printer, Bluetooth, or Save to PDF.
              </p>
            </div>
          </div>

          {/* Share Link Input & Copy */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Direct Mobile Print Link (URL)
            </label>
            <div className="flex gap-2">
              <input
                id="share-link-input"
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-700 truncate select-all focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
              <button
                id="copy-share-link-btn"
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition cursor-pointer shrink-0"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Compatibility Badges */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="font-medium text-slate-700">Native Support:</span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]">
              <Apple className="w-3 h-3" /> iOS AirPrint
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]">
              <Wifi className="w-3 h-3" /> Android Default Print / Mopria
            </span>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]">
              <FileText className="w-3 h-3" /> Native PDF Export
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
