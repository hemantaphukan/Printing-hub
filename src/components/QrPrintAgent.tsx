import React, { useState, useEffect, useRef } from 'react';
import { BusinessPrintOrder, StationConfig, AgentLogEntry, PrintJob } from '../types';
import {
  fetchOrders,
  updateOrderStatus,
  subscribeToOrdersStream,
  updateStationConfig,
  submitCustomerOrder,
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
  Pause,
  RotateCw,
  Eye,
  Trash2,
  Settings,
  HelpCircle,
  DollarSign,
  FileText,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Download,
  Share2,
  ChevronRight,
  ShieldAlert,
  Info,
  X,
  Radio,
  Terminal,
  ShieldCheck,
  Zap,
  Sliders,
  Cpu,
  Activity,
  Layers,
  Store,
  Smartphone
} from 'lucide-react';

interface QrPrintAgentProps {
  stationConfig: StationConfig;
  onUpdateStationConfig: (config: StationConfig) => void;
  onExitAgent?: () => void;
  onOpenCustomerPortal?: () => void;
}

export const QrPrintAgent: React.FC<QrPrintAgentProps> = ({
  stationConfig,
  onUpdateStationConfig,
  onExitAgent,
  onOpenCustomerPortal,
}) => {
  const stationId = stationConfig.stationId || 'counter-main';

  // Agent configuration states
  const [autoPrintEnabled, setAutoPrintEnabled] = useState<boolean>(stationConfig.autoPrintEnabled);
  const [delaySeconds, setDelaySeconds] = useState<number>(stationConfig.autoPrintDelaySeconds ?? 2);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(stationConfig.soundAlertEnabled);
  const [maxPagesLimit, setMaxPagesLimit] = useState<number>(stationConfig.autoPrintMaxPages ?? 15);
  const [allowColorAuto, setAllowColorAuto] = useState<boolean>(stationConfig.autoPrintColorAllowed ?? true);
  const [requirePaid, setRequirePaid] = useState<boolean>(stationConfig.autoPrintRequirePaid ?? false);
  const [printerName, setPrinterName] = useState<string>(stationConfig.targetPrinterName || 'Default System Laser Printer');

  // Orders and Queue
  const [orders, setOrders] = useState<BusinessPrintOrder[]>([]);
  const [counterQrUrl, setCounterQrUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [p2pStatus, setP2pStatus] = useState<ConnectionStatus>('connecting');

  // Active Auto-Printing State Machine
  const [activePrintingOrder, setActivePrintingOrder] = useState<BusinessPrintOrder | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSpoolingDirect, setIsSpoolingDirect] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<BusinessPrintOrder | null>(null);
  const [showConfigDrawer, setShowConfigDrawer] = useState(false);
  const [showSilentPrintGuide, setShowSilentPrintGuide] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Agent Telemetry Log
  const [logs, setLogs] = useState<AgentLogEntry[]>([
    {
      id: 'init-1',
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      message: `QR Print Agent daemon initialized for station: ${stationId}`,
    },
    {
      id: 'init-2',
      timestamp: new Date().toLocaleTimeString(),
      type: 'success',
      message: `Auto-Print engine online. Rule: <= ${maxPagesLimit} pages, delay: ${delaySeconds}s`,
    },
  ]);
  const [logFilter, setLogFilter] = useState<'all' | 'print' | 'warn'>('all');

  const countdownTimerRef = useRef<any>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const addLog = (type: AgentLogEntry['type'], message: string, ticketNumber?: string) => {
    const entry: AgentLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toLocaleTimeString(),
      type,
      message,
      ticketNumber,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 149)]); // Keep last 150
  };

  // 1. Initial orders load & QR generation
  useEffect(() => {
    let isMounted = true;
    fetchOrders().then((data) => {
      if (isMounted) setOrders(data);
    });

    const uploadUrl = buildCustomerUploadUrl(stationId);
    generateQrDataUrl(uploadUrl, 2, 400).then((dataUrl) => {
      if (isMounted) setCounterQrUrl(dataUrl);
    });

    // Initialize P2P receiver
    p2pSync.initHost(
      stationId,
      () => stationConfig,
      (newOrder) => {
        setOrders((prev) => {
          if (prev.some((o) => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
        handleIncomingJob(newOrder);
      },
      (status, msg) => {
        if (isMounted) {
          setP2pStatus(status);
          if (status === 'connected') {
            addLog('info', `P2P Data Channel connected (${msg || 'peer ready'})`);
          }
        }
      }
    );

    return () => {
      isMounted = false;
      p2pSync.destroy();
    };
  }, [stationId]);

  // 2. Subscribe to SSE Order Stream
  useEffect(() => {
    const unsubscribe = subscribeToOrdersStream({
      onNewOrder: (newOrder) => {
        setOrders((prev) => {
          if (prev.some((o) => o.id === newOrder.id)) return prev;
          return [newOrder, ...prev];
        });
        handleIncomingJob(newOrder);
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
        if (cfg.autoPrintDelaySeconds !== undefined) setDelaySeconds(cfg.autoPrintDelaySeconds);
        if (cfg.autoPrintMaxPages !== undefined) setMaxPagesLimit(cfg.autoPrintMaxPages);
      },
    });

    return () => unsubscribe();
  }, [autoPrintEnabled, soundEnabled, delaySeconds, maxPagesLimit, allowColorAuto, requirePaid]);

  // Handle an incoming job according to Auto-Print rules
  const handleIncomingJob = (order: BusinessPrintOrder) => {
    const pages = (order.fileData?.pageCount || 1) * order.copies;
    const isColor = order.colorMode === 'color';

    addLog('info', `Incoming upload: "${order.fileData.fileName}" (${pages}p, ${order.colorMode})`, order.ticketNumber);

    if (soundEnabled) {
      soundManager.playNewJobChime();
    }

    if (!autoPrintEnabled) {
      addLog('warn', `Auto-Print is OFF. Queued ${order.ticketNumber} for manual print.`, order.ticketNumber);
      return;
    }

    // Safety Filter 1: Page limit check
    if (pages > maxPagesLimit) {
      addLog(
        'warn',
        `⚠️ Safety Halt: ${order.ticketNumber} has ${pages} pages (exceeds limit of ${maxPagesLimit}). Held for owner review.`,
        order.ticketNumber
      );
      return;
    }

    // Safety Filter 2: Color policy check
    if (isColor && !allowColorAuto) {
      addLog(
        'warn',
        `⚠️ Color Guard: ${order.ticketNumber} requires color print. Held for owner approval.`,
        order.ticketNumber
      );
      return;
    }

    // Safety Filter 3: Pre-payment check
    if (requirePaid && !order.isPaid) {
      addLog(
        'warn',
        `⚠️ Payment Guard: ${order.ticketNumber} unpaid ($${((order.estimatedPrice ?? 0)).toFixed(2)}). Held until customer pays.`,
        order.ticketNumber
      );
      return;
    }

    // Passed all guardrails: Queue Auto-Print!
    queueAutoPrint(order);
  };

  const queueAutoPrint = (order: BusinessPrintOrder) => {
    setActivePrintingOrder(order);

    if (delaySeconds <= 0) {
      addLog('print', `Instant Auto-Print dispatched for ${order.ticketNumber}`, order.ticketNumber);
      executePrint(order);
    } else {
      addLog('print', `Auto-Print countdown started (${delaySeconds}s) for ${order.ticketNumber}`, order.ticketNumber);
      setCountdown(delaySeconds);
    }
  };

  // Countdown timer effect
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      countdownTimerRef.current = setTimeout(() => {
        if (soundEnabled) soundManager.playCountdownTick();
        setCountdown((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearTimeout(countdownTimerRef.current);
    } else if (countdown === 0) {
      setCountdown(null);
      if (activePrintingOrder) {
        executePrint(activePrintingOrder);
      }
    }
  }, [countdown, activePrintingOrder, soundEnabled]);

  // Execute print to browser/kiosk spooler
  const executePrint = (order: BusinessPrintOrder) => {
    try {
      setIsSpoolingDirect(true);
      setActivePrintingOrder(order);

      // Brief pause to ensure DOM printable stage is mounted
      setTimeout(() => {
        addLog('success', `Sent ${order.ticketNumber} to printer [${printerName}]`, order.ticketNumber);
        
        window.print();

        if (soundEnabled) {
          soundManager.playPrintSentChord();
        }

        // Mark as completed on server and P2P
        p2pSync.updateOrderStatus(order.id, 'completed');
        updateOrderStatus(order.id, {
          status: 'completed',
          autoPrinted: true,
          printedAt: new Date().toISOString(),
        }).then((updated) => {
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        }).catch(() => {
          setOrders((prev) =>
            prev.map((o) => (o.id === order.id ? { ...o, status: 'completed', autoPrinted: true } : o))
          );
        });

        setTimeout(() => {
          setIsSpoolingDirect(false);
          setActivePrintingOrder(null);
        }, 1200);
      }, 200);
    } catch (err) {
      console.error('Agent print error:', err);
      addLog('warn', `Print execution failed for ${order.ticketNumber}: ${err}`, order.ticketNumber);
      setIsSpoolingDirect(false);
      setActivePrintingOrder(null);
    }
  };

  const cancelActiveCountdown = () => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    if (activePrintingOrder) {
      addLog('warn', `Auto-Print cancelled/held by operator for ${activePrintingOrder.ticketNumber}`, activePrintingOrder.ticketNumber);
    }
    setCountdown(null);
    setActivePrintingOrder(null);
  };

  const bypassCountdownPrintNow = () => {
    if (countdownTimerRef.current) clearTimeout(countdownTimerRef.current);
    setCountdown(null);
    if (activePrintingOrder) {
      addLog('print', `Bypassed countdown. Instant printing ${activePrintingOrder.ticketNumber}`, activePrintingOrder.ticketNumber);
      executePrint(activePrintingOrder);
    }
  };

  // Simulator: Simulate an incoming customer QR upload to test the Auto-Print option
  const simulateTestJob = async (type: 'receipt' | 'id-card' | 'photo' | 'oversized') => {
    const isOver = type === 'oversized';
    const pages = isOver ? 25 : type === 'id-card' ? 2 : 1;
    const testFileName =
      type === 'id-card'
        ? 'Customer_ID_FrontBack.jpg'
        : type === 'photo'
        ? 'Vacation_Photo.png'
        : isOver
        ? 'Annual_Financial_Report_2026.pdf'
        : 'Sample_Invoice_Receipt.pdf';

    const testPayload = {
      customerName: 'Test QR Customer',
      customerPhone: '+1 (555) 012-3456',
      fileData: {
        fileName: testFileName,
        fileSize: isOver ? 4200000 : 850000,
        mimeType: isOver ? 'application/pdf' : 'image/jpeg',
        category: isOver ? 'pdf' : 'image',
        pageCount: pages,
        textPreview: 'TEST PRINT AGENT VERIFICATION RUN\nGenerated automatically via QR Print Agent simulator.',
      },
      paperSize: 'letter',
      orientation: 'portrait',
      colorMode: type === 'photo' ? 'color' : 'grayscale',
      copies: 1,
    };

    addLog('info', `[SIMULATOR] Generating simulated customer mobile QR upload...`);
    const { order } = await submitCustomerOrder(testPayload);
    setOrders((prev) => [order, ...prev]);
    handleIncomingJob(order);
  };

  // Convert order to PrintJob for renderer
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

  // Save agent settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated = await updateStationConfig({
      autoPrintEnabled,
      autoPrintDelaySeconds: delaySeconds,
      soundAlertEnabled: soundEnabled,
      autoPrintMaxPages: maxPagesLimit,
      autoPrintColorAllowed: allowColorAuto,
      autoPrintRequirePaid: requirePaid,
      targetPrinterName: printerName,
    });
    onUpdateStationConfig(updated);
    addLog('success', `Agent settings updated and synchronized`);
    setShowConfigDrawer(false);
  };

  // Generate batch launcher script download for silent kiosk mode
  const downloadLauncherScript = (os: 'windows' | 'mac') => {
    const currentUrl = window.location.href.split('#')[0];
    let content = '';
    let filename = '';

    if (os === 'windows') {
      filename = 'start-qr-print-agent-silent.bat';
      content = `@echo off\necho ====================================================\necho  Launching QR Print Agent in Zero-Click Silent Mode\necho ====================================================\necho Target URL: ${currentUrl}\necho.\nstart chrome.exe --kiosk-printing "${currentUrl}"\npause\n`;
    } else {
      filename = 'start-qr-print-agent-silent.sh';
      content = `#!/bin/bash\necho "Starting Chrome in Silent Kiosk Auto-Print mode..."\nopen -a "Google Chrome" --args --kiosk-printing "${currentUrl}"\n`;
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('info', `Downloaded ${filename} for silent auto-print execution`);
  };

  const filteredLogs = logs.filter((l) => {
    if (logFilter === 'print') return l.type === 'print' || l.type === 'success';
    if (logFilter === 'warn') return l.type === 'warn';
    return true;
  });

  const autoPrintedCount = orders.filter((o) => o.autoPrinted || o.status === 'completed').length;
  const queuedOrders = orders.filter((o) => o.status === 'queued');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* 1. AGENT SUPERVISOR HEADER BAR */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          {/* Agent Identity */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                  autoPrintEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  <span>QR Print Agent</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-slate-700 font-semibold">
                    v2.4 Auto-Spooler
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>Station: <strong className="text-slate-200 font-mono">#{stationId}</strong></span>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <Radio className="w-3 h-3 animate-ping" />
                  P2P Direct Sync
                </span>
                <span>•</span>
                <span className="text-slate-300 font-mono truncate max-w-[200px]" title={printerName}>
                  {printerName}
                </span>
              </p>
            </div>
          </div>

          {/* Quick Actions & Toggles */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Master Auto-Print Switch */}
            <button
              type="button"
              onClick={async () => {
                const next = !autoPrintEnabled;
                setAutoPrintEnabled(next);
                await updateStationConfig({ autoPrintEnabled: next });
                addLog(next ? 'success' : 'warn', `Auto-Print toggled ${next ? 'ONLINE' : 'PAUSED'}`);
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer border ${
                autoPrintEnabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-900/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {autoPrintEnabled ? <Zap className="w-4 h-4 text-amber-300 fill-amber-300" /> : <Pause className="w-4 h-4" />}
              <span>Auto-Print: {autoPrintEnabled ? 'ACTIVE' : 'PAUSED'}</span>
            </button>

            {/* Delay Speed Selector */}
            <div className="hidden sm:flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300">
              <span className="px-2 text-[10px] text-slate-400 uppercase tracking-wider font-bold">Delay:</span>
              <button
                type="button"
                onClick={async () => {
                  setDelaySeconds(0);
                  await updateStationConfig({ autoPrintDelaySeconds: 0 });
                  addLog('info', 'Auto-Print delay set to 0s (Instant)');
                }}
                className={`px-2 py-1 rounded-lg text-xs cursor-pointer transition ${
                  delaySeconds === 0 ? 'bg-amber-400 text-slate-950 font-bold' : 'hover:text-white'
                }`}
              >
                0s Instant
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDelaySeconds(2);
                  await updateStationConfig({ autoPrintDelaySeconds: 2 });
                  addLog('info', 'Auto-Print delay set to 2s (Safe)');
                }}
                className={`px-2 py-1 rounded-lg text-xs cursor-pointer transition ${
                  delaySeconds === 2 ? 'bg-amber-400 text-slate-950 font-bold' : 'hover:text-white'
                }`}
              >
                2s
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDelaySeconds(5);
                  await updateStationConfig({ autoPrintDelaySeconds: 5 });
                  addLog('info', 'Auto-Print delay set to 5s (Relaxed)');
                }}
                className={`px-2 py-1 rounded-lg text-xs cursor-pointer transition ${
                  delaySeconds === 5 ? 'bg-amber-400 text-slate-950 font-bold' : 'hover:text-white'
                }`}
              >
                5s
              </button>
            </div>

            {/* Audio Toggle */}
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
                  ? 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-750'
                  : 'bg-slate-800 text-slate-500 border-slate-700'
              }`}
              title="Toggle audio alerts"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Station QR Code Popup */}
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition cursor-pointer"
            >
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>Counter QR</span>
            </button>

            {/* Silent Print Instructions */}
            <button
              type="button"
              onClick={() => setShowSilentPrintGuide(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 font-semibold text-xs transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Silent Auto-Print</span>
            </button>

            {/* Agent Settings Button */}
            <button
              type="button"
              onClick={() => setShowConfigDrawer(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Configure Agent Rules & Printer Profile"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {/* Exit / Switch to Main Shop Station */}
            {onExitAgent && (
              <button
                type="button"
                onClick={onExitAgent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition cursor-pointer"
              >
                <Store className="w-4 h-4 text-slate-400" />
                <span className="hidden md:inline">Exit to Shop Station</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. AGENT STATUS & ACTIVE AUTO-PRINT EXECUTION STAGE */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 no-print">
        {/* HERO STAGE: Active Auto-Print Spooler Card */}
        {countdown !== null && activePrintingOrder ? (
          <div className="bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border-2 border-amber-500 rounded-3xl p-6 shadow-2xl relative overflow-hidden animate-pulse">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 flex flex-col items-center justify-center font-mono font-black shadow-md shrink-0">
                  <span className="text-xl leading-none">{countdown}</span>
                  <span className="text-[9px] uppercase tracking-wider font-bold">SEC</span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-md font-mono">
                      AUTO-PRINTING NOW
                    </span>
                    <span className="text-xs font-mono text-amber-300 font-bold">
                      Ticket {activePrintingOrder.ticketNumber}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight">
                    {activePrintingOrder.fileData.fileName}
                  </h2>
                  <p className="text-xs text-slate-300 flex items-center gap-3">
                    <span>Customer: <strong>{activePrintingOrder.customerName || 'Walk-in'}</strong></span>
                    <span>•</span>
                    <span>Pages: <strong>{activePrintingOrder.fileData.pageCount || 1}</strong></span>
                    <span>•</span>
                    <span className="capitalize">{activePrintingOrder.colorMode}</span>
                    <span>•</span>
                    <span>Target: {printerName}</span>
                  </p>
                </div>
              </div>

              {/* Immediate Actions for the countdown */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={bypassCountdownPrintNow}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm transition cursor-pointer shadow-lg shadow-amber-500/30"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Now</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewOrder(activePrintingOrder)}
                  className="inline-flex items-center justify-center p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                  title="Preview document"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={cancelActiveCountdown}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-red-400 border border-red-500/40 font-bold text-sm transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Abort / Hold</span>
                </button>
              </div>
            </div>

            {/* Linear Countdown Progress bar */}
            <div className="w-full bg-slate-800/80 rounded-full h-2 mt-5 overflow-hidden">
              <div
                className="bg-amber-400 h-2 transition-all duration-1000 ease-linear rounded-full"
                style={{
                  width: `${delaySeconds > 0 ? ((delaySeconds - countdown) / delaySeconds) * 100 : 100}%`,
                }}
              />
            </div>
          </div>
        ) : isSpoolingDirect ? (
          <div className="bg-emerald-950/40 border border-emerald-500/50 rounded-3xl p-6 shadow-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
              <div>
                <h3 className="font-bold text-white text-base">Spooling to Connected Printer...</h3>
                <p className="text-xs text-slate-400">
                  Sending document buffer to system print queue [{printerName}]
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">
              DISPATCHED
            </span>
          </div>
        ) : (
          /* RADAR / IDLE LISTENING STATE */
          <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 shadow-md">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 text-left">
                <div className="relative">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition ${
                      autoPrintEnabled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                    }`}
                  >
                    <Printer className="w-7 h-7" />
                  </div>
                  {autoPrintEnabled && (
                    <span className="absolute top-0 right-0 -mr-1 -mt-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">
                      {autoPrintEnabled ? 'Agent Listening for Customer QR Uploads' : 'Agent Auto-Print is Paused'}
                    </h2>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        autoPrintEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {autoPrintEnabled ? 'AUTONOMOUS' : 'MANUAL QUEUE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    {autoPrintEnabled
                      ? `Any file scanned & sent by mobile customers will auto-print in ${delaySeconds}s (Max: ${maxPagesLimit} pages, Color: ${
                          allowColorAuto ? 'Allowed' : 'Manual Review'
                        }).`
                      : 'Incoming customer files will be collected into the queue without triggering automatic printing.'}
                  </p>
                </div>
              </div>

              {/* Quick Actions: Simulate Test Job */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs font-semibold text-slate-400 mr-1 hidden lg:block">
                  Test Pipeline:
                </div>
                <button
                  type="button"
                  onClick={() => simulateTestJob('receipt')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                  title="Simulate 1-page document test"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Test 1-Page</span>
                </button>

                <button
                  type="button"
                  onClick={() => simulateTestJob('id-card')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                  title="Simulate 2-sided ID Card test"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>Test ID Card</span>
                </button>

                <button
                  type="button"
                  onClick={() => simulateTestJob('oversized')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                  title="Simulate oversized 25-page file (tests safety guardrail)"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  <span>Test Guardrail (&gt;15p)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. TWO-COLUMN SPLIT: TELEMETRY CONSOLE & RECENT PRINT QUEUE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT 7 COLS: Live Agent Telemetry Console */}
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-5 flex flex-col h-[520px] shadow-sm">
            {/* Console Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-sm text-white">Agent Telemetry &amp; Audit Log</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                  {logs.length} events
                </span>
              </div>

              {/* Log Filters */}
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-950 p-0.5 rounded-lg text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setLogFilter('all')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition ${
                      logFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter('print')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition ${
                      logFilter === 'print' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Prints
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter('warn')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition ${
                      logFilter === 'warn' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Warnings
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="p-1 rounded text-slate-500 hover:text-slate-300 transition cursor-pointer"
                  title="Clear logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable Event Log List */}
            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto py-3 space-y-2 font-mono text-xs text-slate-300 pr-1"
            >
              {filteredLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600 text-xs">
                  No log entries matching filter
                </div>
              ) : (
                filteredLogs.map((log) => {
                  return (
                    <div
                      key={log.id}
                      className="p-2 rounded-xl bg-slate-950/60 border border-slate-800/60 flex items-start gap-2.5 leading-relaxed hover:border-slate-700 transition"
                    >
                      <span className="text-[10px] text-slate-500 shrink-0 select-none pt-0.5">
                        {log.timestamp}
                      </span>

                      <div className="shrink-0 pt-0.5">
                        {log.type === 'success' || log.type === 'print' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : log.type === 'warn' ? (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Activity className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                      </div>

                      <div className="flex-1 break-words">
                        {log.ticketNumber && (
                          <span className="inline-block font-bold text-amber-400 mr-1.5 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/40 text-[10px]">
                            {log.ticketNumber}
                          </span>
                        )}
                        <span
                          className={
                            log.type === 'warn'
                              ? 'text-amber-300'
                              : log.type === 'success' || log.type === 'print'
                              ? 'text-emerald-300 font-medium'
                              : 'text-slate-300'
                          }
                        >
                          {log.message}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Telemetry Summary */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 shrink-0 font-sans">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Telemetry Active
              </span>
              <span>Total Auto-Printed: <strong className="text-white font-mono">{autoPrintedCount}</strong></span>
            </div>
          </div>

          {/* RIGHT 5 COLS: Queue Overview & Auto-Print Rules */}
          <div className="lg:col-span-5 space-y-6">
            {/* Active Auto-Print Rules Summary Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-sm text-white">Active Auto-Print Rules</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfigDrawer(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
                >
                  Edit Rules
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                    Max Safe Pages
                  </span>
                  <span className="text-sm font-black text-slate-100 font-mono mt-0.5 block">
                    ≤ {maxPagesLimit} pages
                  </span>
                  <span className="text-[10px] text-slate-400">larger jobs hold for review</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                    Countdown Delay
                  </span>
                  <span className="text-sm font-black text-amber-400 font-mono mt-0.5 block">
                    {delaySeconds} seconds
                  </span>
                  <span className="text-[10px] text-slate-400">{delaySeconds === 0 ? 'Instant spooling' : 'Safety chime'}</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                    Color Prints
                  </span>
                  <span className={`text-xs font-bold mt-0.5 block ${allowColorAuto ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {allowColorAuto ? 'Allowed Auto' : 'Hold for Approval'}
                  </span>
                  <span className="text-[10px] text-slate-400">toner cost protection</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                    Payment Rule
                  </span>
                  <span className={`text-xs font-bold mt-0.5 block ${requirePaid ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {requirePaid ? 'Paid Only' : 'Auto-Print All'}
                  </span>
                  <span className="text-[10px] text-slate-400">walk-in customer speed</span>
                </div>
              </div>
            </div>

            {/* Pending Customer Orders Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h3 className="font-bold text-sm text-white">Pending Queue ({queuedOrders.length})</h3>
                </div>
                {onExitAgent && (
                  <button
                    type="button"
                    onClick={onExitAgent}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    View All Orders →
                  </button>
                )}
              </div>

              {queuedOrders.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-slate-950/60 rounded-2xl border border-slate-800/60 space-y-1">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500/60 mx-auto" />
                  <p className="text-xs font-medium text-slate-400">Queue is Clear</p>
                  <p className="text-[11px] text-slate-500">Auto-Print executes immediately when files arrive</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                  {queuedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded">
                            {order.ticketNumber}
                          </span>
                          <span className="font-bold text-slate-200 truncate">{order.fileData.fileName}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {order.fileData.pageCount || 1}p • {order.colorMode} • {order.customerName || 'Guest'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => executePrint(order)}
                          className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-[11px] transition cursor-pointer"
                        >
                          Print
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewOrder(order)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 4. DEDICATED OFFSCREEN PRINT CONTAINER */}
      {/* Handled by CSS @media print */}
      <div id="agent-auto-print-stage" className="print:block hidden bg-white">
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
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white text-slate-900 rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 relative my-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="font-mono text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded">
                  {previewOrder.ticketNumber}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {previewOrder.fileData.fileName}
                </h3>
                <p className="text-xs text-slate-500">
                  Customer: {previewOrder.customerName || 'Walk-in'} • {previewOrder.colorMode} • {previewOrder.paperSize}
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

      {/* 6. AGENT RULES & CONFIGURATION DRAWER / MODAL */}
      {showConfigDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-800 relative my-6">
            <button
              onClick={() => setShowConfigDrawer(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">QR Print Agent Rules</h3>
                <p className="text-xs text-slate-400">Configure Auto-Print guardrails and behavior</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 pt-4 text-xs">
              {/* Target Printer Profile Name */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Target Printer Profile Name
                </label>
                <input
                  type="text"
                  value={printerName}
                  onChange={(e) => setPrinterName(e.target.value)}
                  placeholder="e.g. Brother HL-L2350D Laser (Duplex)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:border-amber-400 outline-hidden"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Identifies which connected printer this station spools to
                </span>
              </div>

              {/* Countdown Delay Selection */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Auto-Print Countdown Delay
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setDelaySeconds(0)}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs transition cursor-pointer ${
                      delaySeconds === 0
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    0s (Instant)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDelaySeconds(2)}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs transition cursor-pointer ${
                      delaySeconds === 2
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    2s (Safe)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDelaySeconds(5)}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs transition cursor-pointer ${
                      delaySeconds === 5
                        ? 'bg-amber-400 text-slate-950 border-amber-400'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    5s (Relaxed)
                  </button>
                </div>
              </div>

              {/* Max Page Guardrail */}
              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Max Safe Page Limit Threshold: <strong className="text-amber-400">{maxPagesLimit} pages</strong>
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={maxPagesLimit}
                  onChange={(e) => setMaxPagesLimit(parseInt(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>1 page</span>
                  <span>15 pages (recommended)</span>
                  <span>50 pages</span>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Protects ink/paper: files with more pages than this are held for manual confirmation.
                </span>
              </div>

              {/* Checkboxes: Color Guardrail, Paid Requirement */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowColorAuto}
                    onChange={(e) => setAllowColorAuto(e.target.checked)}
                    className="rounded accent-amber-400 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-200">Allow Color Files to Auto-Print</span>
                    <p className="text-[10px] text-slate-400">
                      When unchecked, only B&amp;W jobs auto-print; color jobs require approval.
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requirePaid}
                    onChange={(e) => setRequirePaid(e.target.checked)}
                    className="rounded accent-amber-400 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-200">Require Pre-Payment Before Auto-Print</span>
                    <p className="text-[10px] text-slate-400">
                      When checked, jobs only print after cashier marks them as paid.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfigDrawer(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-800 text-slate-400 hover:text-white font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black transition cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Save Agent Rules
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. SILENT ZERO-CLICK AUTO-PRINT GUIDE & SCRIPT GENERATOR */}
      {showSilentPrintGuide && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-slate-900 text-slate-100 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-800 relative my-6 space-y-4">
            <button
              onClick={() => setShowSilentPrintGuide(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-11 h-11 rounded-2xl bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold border border-cyan-800/60">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Zero-Click Silent Printing Setup
                </h3>
                <p className="text-xs text-slate-400">
                  Bypass the browser confirmation dialog for 100% autonomous printing
                </p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed">
              <p>
                By default, browsers show a &quot;Print Confirmation Dialog&quot;. By launching Chrome with the{' '}
                <strong className="text-cyan-300 font-mono">--kiosk-printing</strong> flag, documents are dispatched
                directly to your default physical printer without any popups!
              </p>

              <div className="space-y-2">
                <div className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Option 1: Download Instant Launcher Script
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => downloadLauncherScript('windows')}
                    className="p-3 bg-slate-950 hover:bg-slate-800 rounded-2xl border border-slate-800 flex items-center gap-2 text-left transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="font-bold text-white">Windows (.bat)</div>
                      <div className="text-[10px] text-slate-500">1-click desktop runner</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadLauncherScript('mac')}
                    className="p-3 bg-slate-950 hover:bg-slate-800 rounded-2xl border border-slate-800 flex items-center gap-2 text-left transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="font-bold text-white">Mac / Linux (.sh)</div>
                      <div className="text-[10px] text-slate-500">Terminal runner</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Option 2: Chrome Shortcut Flag
                </div>
                <div className="bg-slate-950 text-cyan-300 p-3 rounded-xl font-mono text-[11px] select-all break-all border border-slate-800">
                  chrome.exe --kiosk-printing &quot;{window.location.href.split('#')[0]}&quot;
                </div>
                <ul className="list-disc pl-5 space-y-1 text-slate-400 text-[11px]">
                  <li>Right-click your Chrome desktop shortcut and choose <strong>Properties</strong>.</li>
                  <li>Add <code className="text-cyan-300 font-mono">--kiosk-printing</code> to the end of the <strong>Target</strong> field.</li>
                  <li>Ensure your preferred laser printer is set as <strong>Default Printer</strong> in Windows/macOS.</li>
                </ul>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSilentPrintGuide(false)}
              className="w-full py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}

      {/* 8. COUNTER QR POPUP MODAL */}
      {showQrModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white text-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 relative my-6 text-center space-y-4">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Customer Counter QR
              </span>
              <h3 className="text-lg font-black text-slate-900 mt-2">
                Scan to Upload &amp; Print
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Point phone camera at this QR code
              </p>
            </div>

            <div className="p-3 bg-white rounded-2xl border-2 border-slate-900 inline-block shadow-sm">
              {counterQrUrl ? (
                <img
                  src={counterQrUrl}
                  alt="Customer Counter QR"
                  className="w-48 h-48 object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center">
                  <RefreshCw className="w-8 h-8 animate-spin text-slate-400" />
                </div>
              )}
            </div>

            <div className="text-xs font-mono text-slate-500 bg-slate-100 p-2 rounded-xl break-all">
              {buildCustomerUploadUrl(stationId)}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(buildCustomerUploadUrl(stationId));
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied URL' : 'Copy URL'}</span>
              </button>

              {onOpenCustomerPortal && (
                <button
                  type="button"
                  onClick={() => {
                    setShowQrModal(false);
                    onOpenCustomerPortal();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Smartphone className="w-4 h-4 text-slate-600" />
                  <span>Preview</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
