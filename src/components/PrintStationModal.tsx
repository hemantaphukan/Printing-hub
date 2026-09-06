import React, { useState, useEffect } from 'react';
import { PrintJob, StationConfig } from '../types';
import { buildPrintUrl, buildStationUrl, buildCustomerUploadUrl, generateQrDataUrl } from '../utils/codec';
import { X, Printer, QrCode, Sparkles, Check, Download, UploadCloud, FileBox, Store } from 'lucide-react';

interface PrintStationModalProps {
  job: PrintJob;
  stationConfig?: StationConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintStationModal: React.FC<PrintStationModalProps> = ({
  job,
  stationConfig,
  isOpen,
  onClose,
}) => {
  const [stationMode, setStationMode] = useState<'business-counter' | 'station' | 'job'>('business-counter');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      let url = buildCustomerUploadUrl(stationConfig?.stationId);
      if (stationMode === 'station') {
        url = buildStationUrl();
      } else if (stationMode === 'job') {
        url = buildPrintUrl(job);
      }
      const dataUrl = await generateQrDataUrl(url, 2, 550);
      setQrDataUrl(dataUrl);
    };
    load();
  }, [isOpen, job, stationMode]);

  if (!isOpen) return null;

  const handlePrintStationPoster = () => {
    window.print();
  };

  const shopName = stationConfig?.shopName || 'Print Shop & Copy Center';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition cursor-pointer no-print"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Placard Mode Selector (No-print) */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-4 text-xs font-semibold no-print">
          <button
            type="button"
            onClick={() => setStationMode('business-counter')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              stationMode === 'business-counter'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-amber-400" />
            <span>Counter Sign (Shop)</span>
          </button>
          <button
            type="button"
            onClick={() => setStationMode('station')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              stationMode === 'station'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
            <span>Universal</span>
          </button>
          <button
            type="button"
            onClick={() => setStationMode('job')}
            className={`flex-1 py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
              stationMode === 'job'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileBox className="w-3.5 h-3.5 text-emerald-400" />
            <span>This Job Only</span>
          </button>
        </div>

        {/* Printable Placard Card */}
        <div id="print-station-placard" className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-900 text-white mx-auto shadow-sm">
            <Printer className="w-6 h-6 text-amber-400" />
          </div>

          <div>
            <span className="text-[11px] font-bold tracking-widest uppercase text-emerald-600 block mb-1">
              {stationMode === 'business-counter' ? 'Self-Service Mobile Upload' : 'Direct Print Station'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {stationMode === 'business-counter'
                ? `Print at ${shopName}`
                : stationMode === 'station'
                ? 'Scan to Print ANY File Here'
                : 'Scan to Print Document'}
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto leading-relaxed">
              {stationMode === 'business-counter'
                ? 'Scan with your phone camera to select your PDF or Photo. No login or app required — prints directly!'
                : stationMode === 'station'
                ? 'Point your phone camera here to print any PDF, photo, or document directly to this printer.'
                : 'Point your camera at this QR to print this document on this printer instantly.'}
            </p>
          </div>

          {/* Large Sharp QR */}
          <div className="p-4 bg-white border-4 border-slate-900 rounded-3xl inline-block shadow-md my-2">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Station QR Code"
                className="w-56 h-56 object-contain"
              />
            ) : (
              <div className="w-56 h-56 flex items-center justify-center">
                <QrCode className="w-12 h-12 animate-spin text-slate-400" />
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs space-y-2 text-slate-700">
            <div className="font-bold text-slate-900">How it works:</div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">1</span>
              <span>Open your phone's Camera and scan this QR code</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">2</span>
              <span>Select your PDF, Photo, or camera document scan (Instant guest upload, no login)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">3</span>
              <span>Tap <strong>Send to Printer</strong> — our PC printer prints it immediately!</span>
            </div>
          </div>

          {stationConfig && (
            <div className="flex items-center justify-center gap-4 text-[11px] font-bold text-slate-600 bg-slate-100/80 py-2 px-3 rounded-xl">
              <span>
                B&amp;W: {stationConfig.currency || '$'}
                {(stationConfig.pricePerBwPage ?? 0.15).toFixed(2)}/pg
              </span>
              <span>•</span>
              <span>
                Color: {stationConfig.currency || '$'}
                {(stationConfig.pricePerColorPage ?? 0.60).toFixed(2)}/pg
              </span>
            </div>
          )}

          <div className="pt-2 flex gap-3 no-print">
            <button
              type="button"
              onClick={handlePrintStationPoster}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-2xl shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print This Counter Sign (Display on Desk)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3.5 px-4 border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-2xl transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
