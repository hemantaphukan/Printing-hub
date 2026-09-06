/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PrintJob, StationConfig } from './types';
import { SAMPLE_JOBS } from './data/sampleJobs';
import { getPrintJobFromUrl, isCustomerModeUrl } from './utils/codec';
import { fetchStationConfig } from './utils/api';
import { ShopOwnerStation } from './components/ShopOwnerStation';
import { CustomerUploadPortal } from './components/CustomerUploadPortal';
import { MobilePrintView } from './components/MobilePrintView';
import { PrintStationModal } from './components/PrintStationModal';
import { QRSharePanel } from './components/QRSharePanel';
import { JobEditor } from './components/JobEditor';
import { PrintRenderer } from './components/PrintRenderer';
import {
  Printer,
  Smartphone,
  Store,
  Layers,
  Sparkles,
  QrCode,
  ShieldCheck,
  Zap,
  ArrowRightLeft
} from 'lucide-react';

type AppViewMode = 'shop-station' | 'customer-portal' | 'template-builder';

export default function App() {
  // Default mode: Shop Owner PC connected printer station
  const [viewMode, setViewMode] = useState<AppViewMode>('shop-station');
  const [activeJob, setActiveJob] = useState<PrintJob>(SAMPLE_JOBS.document);
  const [isMobileDirectJobMode, setIsMobileDirectJobMode] = useState<boolean>(false);
  const [isStationModalOpen, setIsStationModalOpen] = useState<boolean>(false);

  // Station configuration (Shop name, rates, auto-print settings)
  const [stationConfig, setStationConfig] = useState<StationConfig>({
    shopName: 'QuickPrint Shop & Copy Center',
    shopSubtitle: 'Connected High-Speed Laser Printer Station',
    shopPhone: '+1 (555) 019-2831',
    shopAddress: 'Counter #1 • Main Entrance',
    currency: '$',
    pricePerBwPage: 0.15,
    pricePerColorPage: 0.60,
    autoPrintEnabled: true,
    autoPrintDelaySeconds: 2,
    soundAlertEnabled: true,
    allowCustomerUploads: true,
  });

  // Check URL on initial mount
  useEffect(() => {
    // 1. Fetch server-side station config
    fetchStationConfig().then((cfg) => {
      setStationConfig(cfg);
    });

    // 2. Check if customer scanned counter QR (URL has ?mode=customer)
    if (isCustomerModeUrl()) {
      setViewMode('customer-portal');
      return;
    }

    // 3. Check if opened with direct print job hash (#print=...)
    const jobFromUrl = getPrintJobFromUrl();
    if (jobFromUrl) {
      setActiveJob(jobFromUrl);
      setIsMobileDirectJobMode(true);
    }
  }, []);

  // Listen for hash / popstate
  useEffect(() => {
    const handleUrlChange = () => {
      if (isCustomerModeUrl()) {
        setViewMode('customer-portal');
        return;
      }
      const jobFromUrl = getPrintJobFromUrl();
      if (jobFromUrl) {
        setActiveJob(jobFromUrl);
        setIsMobileDirectJobMode(true);
      }
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // If opened via direct encoded job payload
  if (isMobileDirectJobMode) {
    return (
      <MobilePrintView
        job={activeJob}
        onBackToEditor={() => {
          if (window.location.hash) {
            history.pushState(null, '', window.location.pathname + window.location.search);
          }
          setIsMobileDirectJobMode(false);
        }}
        onUpdateJob={(updated) => setActiveJob(updated)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col selection:bg-slate-900 selection:text-white">
      {/* GLOBAL SYSTEM ROLE SWITCHER BAR (Only displayed on Shop PC & Templates, NEVER for Customers after QR Scan) */}
      {viewMode !== 'customer-portal' && (
        <div className="bg-slate-950 text-slate-300 text-xs py-2 px-4 border-b border-slate-800 no-print">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white font-bold">Business Print Hub:</span>
              <span className="hidden sm:inline text-slate-400">
                Customer Scans QR ➔ Shop PC reads printing command &amp; prints automatically
              </span>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setViewMode('shop-station')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition cursor-pointer ${
                  viewMode === 'shop-station'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Shop Owner PC (Connected Printer)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('customer-portal')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg transition cursor-pointer ${
                  viewMode === 'customer-portal'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Customer Mobile (Scan &amp; Upload)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('template-builder')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition cursor-pointer hidden md:inline-flex ${
                  viewMode === 'template-builder'
                    ? 'bg-amber-400 text-slate-950 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Templates</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: SHOP OWNER PC CONNECTED PRINTER STATION (PRIMARY) */}
      {viewMode === 'shop-station' && (
        <ShopOwnerStation
          stationConfig={stationConfig}
          onUpdateStationConfig={(updated) => setStationConfig(updated)}
          onOpenCustomerPortal={() => setViewMode('customer-portal')}
          onOpenPlacardModal={() => setIsStationModalOpen(true)}
        />
      )}

      {/* VIEW 2: CUSTOMER UPLOAD PORTAL (SCAN QR FROM MOBILE - ZERO LOGIN) */}
      {viewMode === 'customer-portal' && (
        <>
          <CustomerUploadPortal
            stationConfig={stationConfig}
          />
          {/* Shopkeeper local preview exit button: ONLY visible when manually previewing in desktop browser, NEVER on mobile QR scan */}
          {!isCustomerModeUrl() && (
            <button
              type="button"
              onClick={() => setViewMode('shop-station')}
              className="fixed bottom-4 right-4 z-40 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-xl border border-slate-700 hover:bg-slate-800 transition flex items-center gap-2 cursor-pointer no-print"
            >
              <Store className="w-4 h-4 text-amber-400" />
              <span>Exit Preview ➔ Shop PC</span>
            </button>
          )}
        </>
      )}

      {/* VIEW 3: TEMPLATE / JOB BUILDER & DIRECT LINK GENERATOR */}
      {viewMode === 'template-builder' && (
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Custom Document &amp; Label Generator</h2>
              <p className="text-xs text-slate-500">Design custom receipts, passes, and shipping labels</p>
            </div>
            <button
              type="button"
              onClick={() => setViewMode('shop-station')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
            >
              <Store className="w-4 h-4 text-amber-400" />
              <span>Back to Connected Shop PC</span>
            </button>
          </div>

          <QRSharePanel
            job={activeJob}
            onOpenMobileView={() => setIsMobileDirectJobMode(true)}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7">
              <JobEditor
                job={activeJob}
                onUpdateJob={(updated) => setActiveJob(updated)}
                onPreview={() => setIsMobileDirectJobMode(true)}
              />
            </div>

            <div className="lg:col-span-5 sticky top-24">
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                  Live Printable Sheet Preview
                </div>
                <div className="bg-slate-100/80 p-3 rounded-xl border border-slate-200/80 overflow-hidden flex items-center justify-center">
                  <div className="w-full max-h-[500px] overflow-y-auto bg-white rounded-lg shadow-sm border border-slate-300">
                    <PrintRenderer job={activeJob} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Counter Stand / Placard Modal */}
      <PrintStationModal
        job={activeJob}
        stationConfig={stationConfig}
        isOpen={isStationModalOpen}
        onClose={() => setIsStationModalOpen(false)}
      />
    </div>
  );
}
