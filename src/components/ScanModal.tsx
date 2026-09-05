import React, { useState } from 'react';
import { decodePrintJob } from '../utils/codec';
import { PrintJob } from '../types';
import { X, QrCode, ArrowRight, AlertCircle } from 'lucide-react';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadJob: (job: PrintJob) => void;
}

export const ScanModal: React.FC<ScanModalProps> = ({ isOpen, onClose, onLoadJob }) => {
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResolve = () => {
    setError(null);
    if (!inputUrl.trim()) {
      setError('Please enter a link or paste a print code');
      return;
    }

    try {
      let payload = inputUrl.trim();
      if (payload.includes('#print=')) {
        payload = payload.split('#print=')[1];
      } else if (payload.includes('?print=')) {
        const url = new URL(payload, window.location.origin);
        payload = url.searchParams.get('print') || '';
      }

      const decoded = decodePrintJob(payload);
      if (decoded) {
        onLoadJob(decoded);
        onClose();
      } else {
        setError('Could not decode print job from that URL. Please verify the link.');
      }
    } catch {
      setError('Invalid link format. Please paste a valid Scan & Print link.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Open Scanned Link</h3>
            <p className="text-xs text-slate-500">Paste a print link to test on this device</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Print Link or Hash
            </label>
            <textarea
              rows={3}
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="https://.../#print=... or paste code"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleResolve}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              <span>Open Document to Print</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
