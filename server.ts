import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Increase payload limit to support PDFs and high-resolution camera scans
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// In-memory business print orders queue and station settings
interface OrderRecord {
  id: string;
  ticketNumber: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  fileData: any;
  paperSize: string;
  orientation: string;
  colorMode: string;
  copies: number;
  pageRange?: string;
  doubleSided?: boolean;
  customerNotes?: string;
  status: 'queued' | 'printing' | 'completed' | 'cancelled';
  estimatedPrice: number;
  isPaid: boolean;
  printedAt?: string;
  autoPrinted?: boolean;
}

let ticketCounter = 101;
let stationConfig = {
  shopName: 'QuickPrint Shop & Copy Center',
  shopSubtitle: 'Connected High-Speed Laser Printer Station',
  shopPhone: '+1 (555) 019-2831',
  shopAddress: 'Counter #1 • Main Entrance',
  currency: '$',
  pricePerBwPage: 0.15,
  pricePerColorPage: 0.60,
  autoPrintEnabled: true,
  autoPrintDelaySeconds: 2, // 2-second safe spool delay with audio chime
  soundAlertEnabled: true,
  allowCustomerUploads: true,
};

let ordersQueue: OrderRecord[] = [
  // Seed with an initial sample job so owner sees the interface in action right away
  {
    id: 'sample-seed-01',
    ticketNumber: '#P-100',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    customerName: 'Demo Customer (Alice)',
    customerPhone: '555-0142',
    paperSize: 'letter',
    orientation: 'portrait',
    colorMode: 'color',
    copies: 1,
    pageRange: 'All',
    doubleSided: false,
    customerNotes: 'Please check high-quality print setting',
    status: 'completed',
    estimatedPrice: 0.60,
    isPaid: true,
    printedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    autoPrinted: true,
    fileData: {
      fileName: 'Sample_Invoice_Receipt.pdf',
      fileSize: 142000,
      mimeType: 'application/pdf',
      category: 'pdf',
      pageCount: 1,
      showPageNumbers: true,
      textPreview: `DEMO PRINT SAMPLE - QUICKPRINT COPY CENTER\nCustomer: Alice M.\nOrder: Color Test Document\nStatus: Complete\nThank you for choosing automated counter printing!`,
    },
  },
];

// Server-Sent Events (SSE) subscribers
type SseClient = {
  id: string;
  res: Response;
};
let sseClients: SseClient[] = [];

function broadcastSse(eventType: string, data: any) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch {
      // client disconnected
    }
  });
}

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    queueLength: ordersQueue.length,
    activeSubscribers: sseClients.length,
  });
});

// 2. Station Configuration
app.get('/api/station-config', (req, res) => {
  res.json(stationConfig);
});

app.post('/api/station-config', (req, res) => {
  stationConfig = { ...stationConfig, ...req.body };
  broadcastSse('config-updated', stationConfig);
  res.json({ success: true, config: stationConfig });
});

// 3. Print Orders API
app.get('/api/orders', (req, res) => {
  res.json(ordersQueue);
});

app.post('/api/orders', (req, res) => {
  try {
    const body = req.body;
    const pages = Number(body.fileData?.pageCount || 1);
    const copies = Number(body.copies || 1);
    const isColor = body.colorMode === 'color';
    const unitPrice = isColor ? stationConfig.pricePerColorPage : stationConfig.pricePerBwPage;
    const estimatedPrice = parseFloat((pages * copies * unitPrice).toFixed(2));

    const newOrder: OrderRecord = {
      id: `ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      ticketNumber: `#P-${ticketCounter++}`,
      createdAt: new Date().toISOString(),
      customerName: body.customerName?.trim() || 'Counter Customer',
      customerPhone: body.customerPhone?.trim() || '',
      fileData: body.fileData || {},
      paperSize: body.paperSize || 'letter',
      orientation: body.orientation || 'portrait',
      colorMode: body.colorMode || 'color',
      copies: Math.max(1, copies),
      pageRange: body.pageRange || 'All',
      doubleSided: Boolean(body.doubleSided),
      customerNotes: body.customerNotes || '',
      status: 'queued',
      estimatedPrice,
      isPaid: false,
      autoPrinted: false,
    };

    // Prepend new order to queue so it appears at top
    ordersQueue.unshift(newOrder);

    // Keep queue memory bounded to 150 items
    if (ordersQueue.length > 150) {
      ordersQueue = ordersQueue.slice(0, 150);
    }

    // Broadcast immediately to Shop Owner PC via SSE!
    broadcastSse('new-order', newOrder);

    res.status(201).json({
      success: true,
      order: newOrder,
      stationConfig,
    });
  } catch (err: any) {
    console.error('Error creating print order:', err);
    res.status(500).json({ error: err.message || 'Failed to submit print order' });
  }
});

app.patch('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const orderIndex = ordersQueue.findIndex((o) => o.id === id);
  if (orderIndex === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const existing = ordersQueue[orderIndex];
  const updated: OrderRecord = {
    ...existing,
    ...req.body,
    // If marking as printing or completed, record timestamp if not set
    printedAt: req.body.status === 'completed' ? new Date().toISOString() : existing.printedAt,
  };

  ordersQueue[orderIndex] = updated;
  broadcastSse('order-updated', updated);

  res.json({ success: true, order: updated });
});

app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  ordersQueue = ordersQueue.filter((o) => o.id !== id);
  broadcastSse('order-deleted', { id });
  res.json({ success: true });
});

app.post('/api/orders/clear-completed', (req, res) => {
  ordersQueue = ordersQueue.filter((o) => o.status !== 'completed' && o.status !== 'cancelled');
  broadcastSse('queue-cleared', { remaining: ordersQueue.length });
  res.json({ success: true });
});

// 4. Server-Sent Events (SSE) Stream for real-time live printing commands to PC
app.get('/api/orders/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const client: SseClient = { id: clientId, res };
  sseClients.push(client);

  // Send initial connected event with state
  res.write(
    `event: connected\ndata: ${JSON.stringify({
      message: 'Connected to Shop Printer Live Spooler',
      queueCount: ordersQueue.length,
      config: stationConfig,
    })}\n\n`
  );

  // Heartbeat every 25 seconds to keep connection active
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// 5. Mount Vite or serve production static assets
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Print Shop Station Server running on port ${PORT}`);
  });
}

startServer();
