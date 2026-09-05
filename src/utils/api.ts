import { BusinessPrintOrder, StationConfig } from '../types';

const BASE_URL = '';

export async function fetchStationConfig(): Promise<StationConfig> {
  try {
    const res = await fetch(`${BASE_URL}/api/station-config`);
    if (!res.ok) throw new Error('Failed to fetch station config');
    return await res.json();
  } catch (err) {
    console.warn('Using default station config fallback:', err);
    return {
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
}

export async function updateStationConfig(config: Partial<StationConfig>): Promise<StationConfig> {
  const res = await fetch(`${BASE_URL}/api/station-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update station config');
  const data = await res.json();
  return data.config;
}

export async function fetchOrders(): Promise<BusinessPrintOrder[]> {
  try {
    const res = await fetch(`${BASE_URL}/api/orders`);
    if (!res.ok) throw new Error('Failed to fetch print orders');
    return await res.json();
  } catch (err) {
    console.warn('Using local fallback for orders:', err);
    return [];
  }
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
  const res = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to submit print order to shop printer');
  }

  return await res.json();
}

export async function updateOrderStatus(
  id: string,
  updates: Partial<BusinessPrintOrder>
): Promise<BusinessPrintOrder> {
  const res = await fetch(`${BASE_URL}/api/orders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update order');
  const data = await res.json();
  return data.order;
}

export async function deleteOrder(id: string): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/orders/${id}`, {
    method: 'DELETE',
  });
  return res.ok;
}

export async function clearCompletedOrders(): Promise<boolean> {
  const res = await fetch(`${BASE_URL}/api/orders/clear-completed`, {
    method: 'POST',
  });
  return res.ok;
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
