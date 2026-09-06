import { BusinessPrintOrder, StationConfig } from '../types';
import { p2pSync } from './p2pSync';

const BASE_URL = '';
const CONFIG_STORAGE_KEY = 'business_station_config';

function getDefaultConfig(): StationConfig {
  let storedStationId = '';
  if (typeof window !== 'undefined') {
    storedStationId = localStorage.getItem('business_station_id') || '';
    if (!storedStationId) {
      storedStationId = `counter-${Math.random().toString(36).substring(2, 7)}`;
      localStorage.setItem('business_station_id', storedStationId);
    }
  }

  return {
    stationId: storedStationId || 'counter-main',
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
  };
}

export async function fetchStationConfig(): Promise<StationConfig> {
  const defaults = getDefaultConfig();
  let localSaved: Partial<StationConfig> = {};
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (saved) localSaved = JSON.parse(saved);
    } catch (e) {
      // ignore
    }
  }

  try {
    const res = await fetch(`${BASE_URL}/api/station-config`);
    if (res.ok) {
      const serverConfig = await res.json();
      const merged = { ...defaults, ...localSaved, ...serverConfig };
      if (typeof window !== 'undefined') {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    }
  } catch (err) {
    // Offline or static Netlify hosting
  }

  return { ...defaults, ...localSaved };
}

export async function updateStationConfig(config: Partial<StationConfig>): Promise<StationConfig> {
  let merged: StationConfig = { ...getDefaultConfig(), ...config };

  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(CONFIG_STORAGE_KEY);
      const existing = saved ? JSON.parse(saved) : {};
      merged = { ...getDefaultConfig(), ...existing, ...config };
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(merged));
      if (merged.stationId) {
        localStorage.setItem('business_station_id', merged.stationId);
      }
    } catch (e) {
      // ignore
    }
  }

  try {
    const res = await fetch(`${BASE_URL}/api/station-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      const data = await res.json();
      return data.config;
    }
  } catch (e) {
    // Netlify static deployment
  }

  return merged;
}

export async function fetchOrders(): Promise<BusinessPrintOrder[]> {
  const localOrders = p2pSync.getPersistedOrders();

  try {
    const res = await fetch(`${BASE_URL}/api/orders`);
    if (res.ok) {
      const serverOrders: BusinessPrintOrder[] = await res.json();
      // Merge unique by ID, preferring server
      const map = new Map<string, BusinessPrintOrder>();
      localOrders.forEach((o) => map.set(o.id, o));
      serverOrders.forEach((o) => map.set(o.id, o));
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }
  } catch (err) {
    // Netlify static mode
  }

  return localOrders;
}

export async function submitCustomerOrder(orderPayload: {
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
}): Promise<{ order: BusinessPrintOrder; stationConfig: StationConfig }> {
  // Construct complete order
  const unitRate = orderPayload.colorMode === 'color' ? 0.60 : 0.15;
  const pageCount = orderPayload.fileData?.pageCount || 1;
  const estimatedPrice = parseFloat((pageCount * orderPayload.copies * unitRate).toFixed(2));

  const order: BusinessPrintOrder = {
    id: `order-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
    ticketNumber: `#A-${Math.floor(100 + Math.random() * 900)}`,
    createdAt: new Date().toISOString(),
    customerName: orderPayload.customerName?.trim() || 'Guest Customer',
    customerPhone: orderPayload.customerPhone?.trim() || undefined,
    fileData: orderPayload.fileData,
    paperSize: orderPayload.paperSize as any,
    orientation: orderPayload.orientation as any,
    colorMode: orderPayload.colorMode as any,
    copies: orderPayload.copies,
    pageRange: orderPayload.pageRange,
    doubleSided: orderPayload.doubleSided,
    customerNotes: orderPayload.customerNotes?.trim() || undefined,
    status: 'queued',
    estimatedPrice,
    isPaid: false,
  };

  // 1. Send via P2P WebRTC / BroadcastChannel
  await p2pSync.sendOrder(order);

  // 2. Try REST API if server exists
  try {
    const res = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // Netlify static mode
  }

  const stationConfig = await fetchStationConfig();
  return { order, stationConfig };
}

export async function updateOrderStatus(
  id: string,
  updates: Partial<BusinessPrintOrder>
): Promise<BusinessPrintOrder> {
  // Update local
  const orders = p2pSync.getPersistedOrders();
  const target = orders.find((o) => o.id === id);
  const updated: BusinessPrintOrder = target ? { ...target, ...updates } : ({ id, ...updates } as any);
  p2pSync.persistOrderLocally(updated);

  if (updates.status) {
    p2pSync.updateOrderStatus(id, updates.status);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      return data.order;
    }
  } catch (e) {
    // Netlify static mode
  }

  return updated;
}

export async function deleteOrder(id: string): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      const orders = p2pSync.getPersistedOrders().filter((o) => o.id !== id);
      localStorage.setItem('station_received_orders', JSON.stringify(orders));
    } catch (e) {
      // ignore
    }
  }

  try {
    const res = await fetch(`${BASE_URL}/api/orders/${id}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch (e) {
    return true;
  }
}

export async function clearCompletedOrders(): Promise<boolean> {
  if (typeof window !== 'undefined') {
    try {
      const orders = p2pSync.getPersistedOrders().filter((o) => o.status !== 'completed');
      localStorage.setItem('station_received_orders', JSON.stringify(orders));
    } catch (e) {
      // ignore
    }
  }

  try {
    const res = await fetch(`${BASE_URL}/api/orders/clear-completed`, {
      method: 'POST',
    });
    return res.ok;
  } catch (e) {
    return true;
  }
}

export function subscribeToOrdersStream(callbacks: {
  onNewOrder: (order: BusinessPrintOrder) => void;
  onOrderUpdated: (order: BusinessPrintOrder) => void;
  onOrderDeleted: (id: string) => void;
  onConfigUpdated?: (config: StationConfig) => void;
}): () => void {
  if (typeof window === 'undefined' || !window.EventSource) {
    return () => {};
  }

  let eventSource: EventSource | null = null;
  let isClosed = false;

  try {
    eventSource = new EventSource(`${BASE_URL}/api/orders/stream`);

    eventSource.addEventListener('new-order', (e) => {
      try {
        const order = JSON.parse(e.data);
        callbacks.onNewOrder(order);
      } catch (err) {
        console.error('Error parsing new-order event:', err);
      }
    });

    eventSource.addEventListener('order-updated', (e) => {
      try {
        const order = JSON.parse(e.data);
        callbacks.onOrderUpdated(order);
      } catch (err) {
        console.error('Error parsing order-updated event:', err);
      }
    });

    eventSource.addEventListener('order-deleted', (e) => {
      try {
        const { id } = JSON.parse(e.data);
        callbacks.onOrderDeleted(id);
      } catch (err) {
        console.error('Error parsing order-deleted event:', err);
      }
    });

    if (callbacks.onConfigUpdated) {
      eventSource.addEventListener('config-updated', (e) => {
        try {
          const config = JSON.parse(e.data);
          callbacks.onConfigUpdated!(config);
        } catch (err) {
          console.error('Error parsing config-updated event:', err);
        }
      });
    }

    eventSource.onerror = () => {
      if (isClosed) return;
      // Browser EventSource automatically attempts reconnection
    };
  } catch (err) {
    console.warn('Failed to establish EventSource connection:', err);
  }

  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };
}
