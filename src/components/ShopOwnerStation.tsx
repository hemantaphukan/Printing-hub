import React, { useState, useEffect, useRef } from 'react';
import { BusinessPrintOrder, StationConfig, PaperSize, PrintJob } from '../types';
import {
  fetchOrders,
  updateOrderStatus,
  deleteOrder,
  clearCompletedOrders,
  subscribeToOrdersStream,
  updateStationConfig,
  formatCurrency,
} from '../utils/api';
import { soundManager } from '../utils/audioChime';
import { buildCustomerUploadUrl, generateQrDataUrl } from '../utils/codec';
import { p2pSync, ConnectionStatus } from '../utils/p2pSync';
import { UploadedFileRenderer } from './UploadedFileRenderer';
import { formatBytes } from '../utils/fileProcessor';
import {
  Printer,
  QrCode,
  CheckCircle2,
  Clock,
  AlertCircle,
  Volume2,
  VolumeX,
  Play,
  RotateCw,
  Eye,
  Trash2,
  Settings,
  HelpCircle,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Download,
  Share2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Info,
  Layers,
  X,
  Pause,
  Globe,
  Radio,
  Cpu
} from 'lucide-react';

interface ShopOwnerStationProps {
  stationConfig: StationConfig;
  onUpdateStationConfig: (config: StationConfig) => void;
  onOpenCustomerPortal: () => void;
  onOpenPlacardModal: () => void;
  onOpenPrintAgent?: () => void;
}

export const ShopOwnerStation: React.FC<ShopOwnerStationProps> = ({
  stationConfig,
  onUpdateStationConfig,
  onOpenCustomerPortal,
  onOpenPlacardModal,
  onOpenPrintAgent,
}) => {
  const [orders, setOrders] = useState<BusinessPrintOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'all' | 'queued' | 'completed' | 'unpaid'>('all');
  const [counterQrUrl, setCounterQrUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Auto-print engine state
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(stationConfig.autoPrintEnabled);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(stationConfig.soundAlertEnabled);
  const [activePrintingOrder, setActivePrintingOrder] = useState<BusinessPrintOrder | null>(null);
  const [autoPrintCountdown, setAutoPrintCountdown] = useState<number | null>(null);
  const [previewOrder, setPreviewOrder] = useState<BusinessPrintOrder | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showKioskModal, setShowKioskModal] = useState(false);
  const [showNetlifyModal, setShowNetlifyModal] = useState(false);

  // P2P synchronization state
  const [p2pStatus, setP2pStatus] = useState<ConnectionStatus>('connecting');
  const [p2pMessage, setP2pMessage] = useState<string>('');

  // Settings form state
  const [editConfig, setEditConfig] = useState<StationConfig>(stationConfig);

  const countdownTimerRef = useRef<any>(null);

  const stationId = stationConfig.stationId || 'counter-main';

  // 1. Initial orders load & QR generation
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const data = await fetchOrders();
        if (isMounted) {
          setOrders(data);
          setLoading(false);
        }
      } catch (e) {
        console.error('Failed to load initial orders:', e);
        if (isMounted) setLoading(false);
      }
    };
    load();

    const uploadUrl = buildCustomerUploadUrl(stationId);
    generateQrDataUrl(uploadUrl, 2, 400).then((dataUrl) => {
      if (isMounted) setCounterQrUrl(dataUrl);
    });

    // 2. Initialize WebRTC P2P Direct Receiver for Mobile uploads (Netlify static support)
    p2pSync.initHost(
      stationId,
      () => stationConfig,
      (newOrder) => {
        setOrders((prev) => {
          if (prev.some((o) => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });

        if (soundEnabled) {
          soundManager.playNewJobChime();
        }

        if (autoPrintEnabled) {
          queueAutoPrint(newOrder);
        }
      },
      (status, msg) => {
        if (isMounted) {
          setP2pStatus(status);
          if (msg) setP2pMessage(msg);
        }
      }
    );

    return () => {
      isMounted = false;
      p2pSync.destroy();
    };
  }, [stationId]);

  // 3. Real-time Server-Sent Events (SSE) subscription for incoming orders from customer phones
  useEffect(() => {
    const unsubscribe = subscribeToOrdersStream({
      onNewOrder: (newOrder) => {
        setOrders((prev) => {
          // Avoid duplicate
          if (prev.some((o) => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });

        // 🔔 Play notification chime on Shop PC
        if (soundEnabled) {
          soundManager.playNewJobChime();
        }

        // 🖨️ Trigger Automatic Print Spooler if enabled
        if (autoPrintEnabled) {
          queueAutoPrint(newOrder);
        }
      },
      onOrderUpdated: (updated) => {
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      },
      onOrderDeleted: (id) => {
        setOrders((prev) => prev.filter((o) => o.id !== id));
      },
      onConfigUpdated: (cfg) => {
        onUpdateStationConfig(cfg);
        setAutoPrintEnabled(cfg.autoPrintEnabled);
        setSoundEnabled(cfg.soundAlertEnabled);
      },
    });

    return () => unsubscribe();
  }, [autoPrintEnabled, soundEnabled, onUpdateStationConfig]);

  // Handle auto-print countdown & execution
  const queueAutoPrint = (order: BusinessPrintOrder) => {
    setActivePrintingOrder(order);
    const delay = stationConfig.autoPrintDelaySeconds || 2;

    if (delay <= 0) {
      // Instant print
      executePrint(order);
    } else {
      setAutoPrintCountdown(delay);
    }
  };

  useEffect(() => {
    if (autoPrintCountdown === null) return;

    if (autoPrintCountdown > 0) {
      countdownTimerRef.current = setTimeout(() => {
        if (soundEnabled) soundManager.playCountdownTick();
        setAutoPrintCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearTimeout(countdownTimerRef.current);
    } else if (autoPrintCountdown === 0) {
      setAutoPrintCountdown(null);
      if (activePrintingOrder) {
        executePrint(activePrintingOrder);
      }
    }
  }, [autoPrintCountdown, activePrintingOrder, soundEnabled]);

  const executePrint = (order: BusinessPrintOrder) => {
    try {
      setActivePrintingOrder(order);

      // Give React 150ms to mount the document into printable stage
      setTimeout(() => {
        window.print();

        if (soundEnabled) {
          soundManager.playPrintSentChord();
        }

        // Mark as completed on server and P2P
        p2pSync.updateOrderStatus(order.id, 'completed');
        updateOrderStatus(order.id, {
          status: 'completed',
          autoPrinted: true,
        }).then((updated) => {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        }).catch(() => {
          setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'completed', autoPrinted: true } : o)));
        });

        // Clear active after print dialog
        setTimeout(() => {
          setActivePrintingOrder(null);
        }, 1000);
      }, 180);
    } catch (err) {
      console.error('Auto print execution error:', err);
      setActivePrintingOrder(null);
    }
  };

  const cancelAutoPrint = () => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    setAutoPrintCountdown(null);
    setActivePrintingOrder(null);
  };

  const handleManualPrint = (order: BusinessPrintOrder) => {
    executePrint(order);
  };

  const handleTogglePaid = async (order: BusinessPrintOrder) => {
    const updated = await updateOrderStatus(order.id, { isPaid: !order.isPaid });
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const handleDeleteOrder = async (id: string) => {
    if (window.confirm('Remove this print job from queue?')) {
      await deleteOrder(id);
      setOrders((prev) => prev.filter((o) => o.id !== id));
    }
  };

  const handleClearCompleted = async () => {
    if (window.confirm('Clear all completed and cancelled jobs from the queue?')) {
      await clearCompletedOrders();
      setOrders((prev) => prev.filter((o) => o.status === 'queued' || o.status === 'printing'));
    }
  };

  const handleCopyLink = () => {
    const url = buildCustomerUploadUrl();
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await updateStationConfig(editConfig);
      onUpdateStationConfig(updated);
      setAutoPrintEnabled(updated.autoPrintEnabled);
      setSoundEnabled(updated.soundAlertEnabled);
      setShowSettingsModal(false);
    } catch (err) {
      console.error('Failed to save station config:', err);
    }
  };

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    if (filterTab === 'queued') return order.status === 'queued' || order.status === 'printing';
    if (filterTab === 'completed') return order.status === 'completed';
    if (filterTab === 'unpaid') return !order.isPaid;
    return true;
  });

  // Analytics
  const totalOrders = orders.length;
  const queuedCount = orders.filter((o) => o.status === 'queued').length;
  const totalPages = orders.reduce((sum, o) => sum + (o.fileData?.pageCount || 1) * o.copies, 0);
  const totalRevenue = orders.reduce((sum, o) => sum + (o.estimatedPrice || 0), 0);
  const unpaidRevenue = orders.filter((o) => !o.isPaid).reduce((sum, o) => sum + (o.estimatedPrice || 0), 0);

  // Convert BusinessPrintOrder into PrintJob for renderer
  const getPrintJobForOrder = (order: BusinessPrintOrder): PrintJob => ({
    id: order.id,
    title: order.fileData?.fileName || `Print Order ${order.ticketNumber}`,
    createdAt: order.createdAt,
    type: 'uploaded-file',
    paperSize: order.paperSize,
    orientation: order.orientation,
    colorMode: order.colorMode,
    autoTrigger: false,
    fontScale: 'md',
    uploadedFile: order.fileData,
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 pb-20">
      {/* 1. TOP SHOP CONTROL BAR (Hidden during actual print) */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md no-print border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-sm">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  {stationConfig.shopName}
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>PC Printer Connected</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Listening live for incoming customer uploads via QR code
              </p>
            </div>
          </div>

          {/* Master Toggles & Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Dedicated QR Print Agent Launcher */}
            {onOpenPrintAgent && (
              <button
                type="button"
                onClick={onOpenPrintAgent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition cursor-pointer shadow-md shadow-amber-500/20"
                title="Launch the dedicated autonomous QR Print Agent dashboard"
              >
                <Cpu className="w-4 h-4" />
                <span>QR Print Agent</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 animate-pulse" />
              </button>
            )}

            {/* Auto-Print Master Switch */}
            <button
              type="button"
              onClick={async () => {
                const next = !autoPrintEnabled;
                setAutoPrintEnabled(next);
                await updateStationConfig({ autoPrintEnabled: next });
              }}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer border ${
                autoPrintEnabled
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Toggle automatic printing when customer uploads file"
            >
              <Printer className="w-4 h-4" />
              <span>Auto-Print: {autoPrintEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* Audio Chime Toggle */}
            <button
              type="button"
              onClick={async () => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) soundManager.playNewJobChime();
                await updateStationConfig({ soundAlertEnabled: next });
              }}
              className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                soundEnabled
                  ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
              title="Toggle sound chimes for new incoming print jobs"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Print Station Sign Placard */}
            <button
              type="button"
              onClick={onOpenPlacardModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Print Counter Sign</span>
            </button>

            {/* Netlify & GitHub Deployment Helper */}
            <button
              type="button"
              onClick={() => setShowNetlifyModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-300 font-semibold text-xs border border-cyan-800/80 transition cursor-pointer"
              title="How to publish this on GitHub and Netlify"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Netlify &amp; GitHub</span>
            </button>

            {/* Customer Portal Preview */}
            <button
              type="button"
              onClick={onOpenCustomerPortal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-slate-300" />
              <span>Customer Mobile View</span>
            </button>

            {/* Settings */}
            <button
              type="button"
              onClick={() => {
                setEditConfig(stationConfig);
                setShowSettingsModal(true);
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Shop Pricing & Station Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ACTIVE AUTO-PRINT COUNTDOWN BAR */}
        {autoPrintCountdown !== null && activePrintingOrder && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2 max-w-xl truncate">
              <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              <span>
                AUTO-PRINTING Ticket {activePrintingOrder.ticketNumber} ({activePrintingOrder.fileData.fileName}) in {autoPrintCountdown}s...
              </span>
            </div>
            <button
              type="button"
              onClick={cancelAutoPrint}
              className="px-3 py-1 rounded-lg bg-slate-950 text-white hover:bg-slate-900 font-black text-xs cursor-pointer shadow-xs"
            >
              Cancel / Pause
            </button>
          </div>
        )}
      </header>

      {/* 2. MAIN PC INTERFACE (Hidden during actual print) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6 no-print">
        {/* TOP ROW: Real-time Stats + Counter QR Card */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* STATS BANNER (3 cols on large) */}
          <div className="lg:col-span-3 space-y-6">
            {/* Quick Status Notice */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Live Spooler Active • Auto-Print is {autoPrintEnabled ? 'Enabled' : 'Disabled'}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Customers scan the counter QR code with their phone, select any file/photo, and your PC connected printer triggers automatically.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onOpenPrintAgent && (
                  <button
                    type="button"
                    onClick={onOpenPrintAgent}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition cursor-pointer shadow-xs"
                  >
                    <Cpu className="w-3.5 h-3.5 text-amber-400" />
                    <span>Launch QR Print Agent</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowKioskModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Zero-Click Silent Print Tip</span>
                </button>
              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Pending Queue
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-slate-900">{queuedCount}</span>
                  <span className="text-xs font-semibold text-amber-600">jobs</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Jobs Today
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-slate-900">{totalOrders}</span>
                  <span className="text-xs text-slate-500">submitted</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Sheets/Pages
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-slate-900">{totalPages}</span>
                  <span className="text-xs text-slate-500">pages</span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Unpaid Balance
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-emerald-700 font-mono">
                    {formatCurrency(unpaidRevenue || 0, stationConfig.currency)}
                  </span>
                  <span className="text-[10px] text-slate-400">due</span>
                </div>
              </div>
            </div>
          </div>

          {/* COUNTER QR STAND CARD (1 col on large) */}
          <div className="bg-white rounded-3xl p-5 border-2 border-slate-900 shadow-sm flex flex-col items-center text-center justify-between space-y-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Customer Counter QR
              </span>
              <h4 className="font-bold text-slate-900 text-sm mt-1.5">
                Scan with Phone to Print
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Point phone camera here to upload
              </p>
            </div>

            <div className="p-2 bg-white rounded-2xl border border-slate-300 shadow-2xs">
              {counterQrUrl ? (
                <img
                  src={counterQrUrl}
                  alt="Customer Counter QR"
                  className="w-36 h-36 object-contain"
                />
              ) : (
                <div className="w-36 h-36 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              )}
            </div>

            <div className="w-full flex gap-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-[11px] font-bold text-slate-700 transition cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenPlacardModal}
                className="flex-1 inline-flex items-center justify-center gap-1 py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Stand Sign</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. INCOMING PRINT QUEUE TABLE */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Queue Header & Filters */}
          <div className="p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-900">
                Incoming Customer Print Orders
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                {orders.length} Total
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterTab('all')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    filterTab === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({orders.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('queued')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    filterTab === 'queued'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Queued ({queuedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('unpaid')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    filterTab === 'unpaid'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Unpaid
                </button>
              </div>

              {/* Clear Completed */}
              <button
                type="button"
                onClick={handleClearCompleted}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-600 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Clear Completed</span>
              </button>
            </div>
          </div>

          {/* Table / List */}
          {loading ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-slate-400 mx-auto" />
              <p className="text-xs font-semibold">Connecting to printer spooler...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <Printer className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">No print jobs in this tab</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Customer upload requests will appear here automatically with sound notification as soon as they scan the QR code.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-x-auto">
              {filteredOrders.map((order) => {
                const isPrintingNow = activePrintingOrder?.id === order.id;
                const pages = order.fileData?.pageCount || 1;
                const isColor = order.colorMode === 'color';

                return (
                  <div
                    key={order.id}
                    className={`p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                      isPrintingNow
                        ? 'bg-amber-50/80 border-l-4 border-amber-500'
                        : order.status === 'queued'
                        ? 'bg-slate-50/60 hover:bg-slate-50'
                        : 'hover:bg-slate-50/50'
                    }`}
                  >
                    {/* Left Column: Ticket Badge + File Info */}
                    <div className="flex items-start gap-3.5 min-w-[280px]">
                      <div className="flex flex-col items-center shrink-0">
                        <span className="font-mono text-sm font-black px-2.5 py-1 rounded-xl bg-slate-900 text-white shadow-2xs">
                          {order.ticketNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono mt-1">
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900 truncate max-w-xs sm:max-w-md">
                            {order.fileData?.fileName || 'Customer File'}
                          </h4>
                          {order.fileData?.category === 'pdf' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              <FileText className="w-3 h-3" /> PDF
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <ImageIcon className="w-3 h-3" /> Image
                            </span>
                          )}
                        </div>

                        {/* Customer details & special notes */}
                        <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {order.customerName || 'Walk-in Customer'}
                          </span>
                          {order.customerPhone && (
                            <span className="text-slate-400">• {order.customerPhone}</span>
                          )}
                          {order.customerNotes && (
                            <span className="text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                              Note: {order.customerNotes}
                            </span>
                          )}
                        </div>

                        {/* File Specs Pill Badges */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 pt-0.5">
                          <span className="bg-slate-200/80 px-2 py-0.5 rounded font-medium text-slate-700">
                            {pages} {pages === 1 ? 'Page' : 'Pages'} × {order.copies}{' '}
                            {order.copies === 1 ? 'Copy' : 'Copies'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              isColor
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isColor ? 'Color' : 'B&W'}
                          </span>
                          <span className="capitalize text-slate-600 font-medium">
                            {order.paperSize}
                          </span>
                          {order.doubleSided && (
                            <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-medium">
                              Duplex
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle Column: Price & Payment Status */}
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-base font-black text-slate-900 font-mono">
                          {formatCurrency(order.estimatedPrice ?? 0, stationConfig.currency)}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTogglePaid(order)}
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition cursor-pointer ${
                            order.isPaid
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                          }`}
                          title="Click to toggle Paid/Unpaid"
                        >
                          {order.isPaid ? '✓ Paid' : '● Unpaid'}
                        </button>
                      </div>

                      {/* Status indicator */}
                      <div className="min-w-[90px] text-center">
                        {order.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Printed
                          </span>
                        ) : order.status === 'printing' || isPrintingNow ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 animate-pulse">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Spooling
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                            <Clock className="w-3.5 h-3.5" /> Queued
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Direct Print & Preview Action Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleManualPrint(order)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition cursor-pointer ${
                          order.status === 'queued'
                            ? 'bg-slate-900 hover:bg-slate-800 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                        }`}
                        title="Execute print command to connected printer"
                      >
                        <Printer className="w-4 h-4 text-amber-400" />
                        <span>{order.status === 'completed' ? 'Re-Print' : 'Print Now'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPreviewOrder(order)}
                        className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                        title="Preview document pages"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteOrder(order.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete order"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* 4. DEDICATED OFFSCREEN PRINT CONTAINER */}
      {/* When window.print() is called on PC, CSS @media print prints ONLY this active document */}
      <div id="shop-auto-print-stage" className="print:block hidden bg-white">
        {activePrintingOrder && (
          <UploadedFileRenderer
            job={getPrintJobForOrder(activePrintingOrder)}
            fileData={activePrintingOrder.fileData}
          />
        )}
      </div>

      {/* 5. PREVIEW DOCUMENT MODAL */}
      {previewOrder && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 relative my-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="font-mono text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded">
                  {previewOrder.ticketNumber}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {previewOrder.fileData.fileName}
                </h3>
                <p className="text-xs text-slate-500">
                  Customer: {previewOrder.customerName || 'Walk-in'} • Mode: {previewOrder.colorMode}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    executePrint(previewOrder);
                    setPreviewOrder(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-amber-400" />
                  <span>Send to Printer Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewOrder(null)}
                  className="p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="py-4 max-h-[70vh] overflow-y-auto">
              <UploadedFileRenderer
                job={getPrintJobForOrder(previewOrder)}
                fileData={previewOrder.fileData}
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. STATION SETTINGS & PRICING MODAL */}
      {showSettingsModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-6">
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                <Settings className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Station &amp; Price Settings</h3>
                <p className="text-xs text-slate-500">Configure rates shown to customers</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 pt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Shop / Business Name</label>
                  <input
                    type="text"
                    value={editConfig.shopName}
                    onChange={(e) => setEditConfig({ ...editConfig, shopName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Station Code (Pairs QR to this PC)
                  </label>
                  <input
                    type="text"
                    value={editConfig.stationId || ''}
                    onChange={(e) =>
                      setEditConfig({
                        ...editConfig,
                        stationId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
                      })
                    }
                    placeholder="counter-1"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 text-xs">
                      Currency Symbol
                    </label>
                  </div>
                  <input
                    type="text"
                    value={editConfig.currency}
                    onChange={(e) => setEditConfig({ ...editConfig, currency: e.target.value })}
                    placeholder="INR"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 font-mono"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {['INR', '₹', 'Rs.', '$', '€'].map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => setEditConfig({ ...editConfig, currency: curr })}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition cursor-pointer ${
                          editConfig.currency === curr
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-xs">Auto-Print Delay</label>
                  <select
                    value={editConfig.autoPrintDelaySeconds}
                    onChange={(e) =>
                      setEditConfig({
                        ...editConfig,
                        autoPrintDelaySeconds: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                  >
                    <option value={0}>0s (Instant Execution)</option>
                    <option value={2}>2s (Chime + Safety Countdown)</option>
                    <option value={5}>5s (Pause Buffer)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 text-xs">
                      Rate per B&amp;W Page ({editConfig.currency || 'INR'})
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editConfig.pricePerBwPage}
                      onChange={(e) =>
                        setEditConfig({
                          ...editConfig,
                          pricePerBwPage: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 font-mono"
                    />
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {[5, 10, 15, 20].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setEditConfig({ ...editConfig, pricePerBwPage: rate })}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium transition cursor-pointer ${
                          editConfig.pricePerBwPage === rate
                            ? 'bg-indigo-100 text-indigo-800 border border-indigo-300 font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {rate}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 text-xs">
                      Rate per Color Page ({editConfig.currency || 'INR'})
                    </label>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editConfig.pricePerColorPage}
                      onChange={(e) =>
                        setEditConfig({
                          ...editConfig,
                          pricePerColorPage: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 font-mono"
                    />
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {[5, 10, 15, 20].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setEditConfig({ ...editConfig, pricePerColorPage: rate })}
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium transition cursor-pointer ${
                          editConfig.pricePerColorPage === rate
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {rate}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* QR Print Agent Settings */}
              <div className="pt-2 border-t border-slate-200 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  QR Print Agent Rules
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Target Printer Name
                    </label>
                    <input
                      type="text"
                      value={editConfig.targetPrinterName || ''}
                      onChange={(e) =>
                        setEditConfig({
                          ...editConfig,
                          targetPrinterName: e.target.value,
                        })
                      }
                      placeholder="Default Laser Printer"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Max Auto-Print Pages Limit
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={editConfig.autoPrintMaxPages ?? 15}
                      onChange={(e) =>
                        setEditConfig({
                          ...editConfig,
                          autoPrintMaxPages: parseInt(e.target.value) || 15,
                        })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editConfig.autoPrintColorAllowed ?? true}
                      onChange={(e) =>
                        setEditConfig({
                          ...editConfig,
                          autoPrintColorAllowed: e.target.checked,
                        })
                      }
                      className="rounded accent-slate-900 w-4 h-4"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Allow Color Documents to Auto-Print (Uncheck to require manual confirmation)
                    </span>
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Save Station Configuration
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="py-3 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. KIOSK SILENT PRINTING HELPER MODAL */}
      {showKioskModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-6 space-y-4">
            <button
              onClick={() => setShowKioskModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Zero-Click 100% Silent Printing
                </h3>
                <p className="text-xs text-slate-500">
                  How print shops bypass the browser print confirmation dialog
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed">
              <p>
                In standard web browsers, <code>window.print()</code> brings up the system print dialog. For an unattended or ultra-fast copy shop station, you can enable Chrome / Edge <strong>Kiosk Silent Printing</strong>:
              </p>

              <div className="bg-slate-900 text-amber-300 p-3 rounded-xl font-mono text-[11px] select-all break-all">
                chrome.exe --kiosk-printing
              </div>

              <div className="space-y-1.5 pl-2 border-l-2 border-slate-300">
                <div className="font-semibold text-slate-800">Setup Instructions:</div>
                <p>1. Set your shop's laser printer as the <strong>Default Printer</strong> in Windows or macOS.</p>
                <p>2. Right-click your Chrome desktop shortcut, select <strong>Properties</strong>.</p>
                <p>3. In the <strong>Target</strong> box, add <code>--kiosk-printing</code> at the end of the line.</p>
                <p>4. Launch Chrome with this shortcut. Now, whenever any customer sends a file, your connected printer will print it immediately without any clicks!</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowKioskModal(false)}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* 8. NETLIFY & GITHUB DEPLOYMENT GUIDE MODAL */}
      {showNetlifyModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-6 space-y-5">
            <button
              onClick={() => setShowNetlifyModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
              <div className="w-11 h-11 rounded-2xl bg-cyan-100 text-cyan-900 flex items-center justify-center">
                <Globe className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Deploy to GitHub &amp; Netlify
                </h3>
                <p className="text-xs text-slate-500">
                  Zero server cost • Direct mobile-to-PC WebRTC printing
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-4 leading-relaxed">
              <div className="bg-cyan-50 border border-cyan-200 rounded-2xl p-3.5 flex gap-2.5">
                <Info className="w-5 h-5 text-cyan-700 shrink-0 mt-0.5" />
                <p className="text-cyan-900 font-medium leading-normal">
                  This app is engineered to run as a 100% static site on <strong>Netlify</strong>. Customer phones connect directly to your shop PC via <strong>WebRTC P2P Data Channels</strong>, requiring zero server maintenance or database costs!
                </p>
              </div>

              <div className="space-y-3">
                <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Step 1: Push Project to GitHub
                </div>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] space-y-1 select-all">
                  <div>git init</div>
                  <div>git add .</div>
                  <div>git commit -m &quot;Universal Mobile Print Station&quot;</div>
                  <div>git branch -M main</div>
                  <div>git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git</div>
                  <div>git push -u origin main</div>
                </div>

                <div className="font-bold text-slate-900 text-xs uppercase tracking-wider pt-2">
                  Step 2: Connect Repo in Netlify
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-slate-700">
                  <p>1. Go to <strong className="text-slate-900">app.netlify.com</strong> and click <strong>&quot;Add new site&quot; &gt; &quot;Import an existing project&quot;</strong>.</p>
                  <p>2. Select <strong>GitHub</strong> and choose your repository.</p>
                  <p>3. Netlify will auto-detect the configuration from <code className="text-cyan-700 font-bold">netlify.toml</code>:</p>
                  <ul className="list-disc pl-5 space-y-0.5 text-slate-600 text-[11px]">
                    <li>Build command: <code className="text-slate-800 font-mono">npm run build</code></li>
                    <li>Publish directory: <code className="text-slate-800 font-mono">dist</code></li>
                    <li>Single Page App redirect: <code className="text-slate-800 font-mono">/* -&gt; /index.html 200</code></li>
                  </ul>
                  <p>4. Click <strong>&quot;Deploy site&quot;</strong>.</p>
                </div>

                <div className="font-bold text-slate-900 text-xs uppercase tracking-wider pt-2">
                  Step 3: Setup Counter PC &amp; Connected Printer
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-slate-700">
                  <p>1. On your shop PC, open your published Netlify URL (e.g. <code className="text-cyan-700">https://your-shop.netlify.app</code>).</p>
                  <p>2. Click <strong>&quot;Print Counter Sign&quot;</strong> to print the counter placard with your station QR code.</p>
                  <p>3. When customers scan the QR code with their mobile phone, they upload files directly to your counter PC screen ready for printing!</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowNetlifyModal(false)}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Close Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
