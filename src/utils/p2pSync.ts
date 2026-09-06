import Peer from 'peerjs';
import { BusinessPrintOrder, StationConfig, PrintJobStatus } from '../types';

// Chunk size for WebRTC DataChannel (64KB chunks to safely avoid browser WebRTC buffer limit)
const CHUNK_SIZE = 64 * 1024;
const BROADCAST_CHANNEL_NAME = 'print_station_sync_channel';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface OrderChunkMessage {
  type: 'order-chunk';
  orderId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkData: string;
  metadata?: Omit<BusinessPrintOrder, 'fileData'> & {
    fileData: Omit<BusinessPrintOrder['fileData'], 'dataUrl'>;
  };
}

interface OrderAckMessage {
  type: 'order-ack';
  orderId: string;
  ticketNumber: string;
  status: PrintJobStatus;
}

interface OrderStatusUpdateMessage {
  type: 'status-update';
  orderId: string;
  status: PrintJobStatus;
}

interface ConfigRequestMessage {
  type: 'request-config';
}

interface ConfigResponseMessage {
  type: 'config-response';
  config: StationConfig;
}

type SyncMessage =
  | OrderChunkMessage
  | OrderAckMessage
  | OrderStatusUpdateMessage
  | ConfigRequestMessage
  | ConfigResponseMessage
  | { type: 'ping' }
  | { type: 'pong' };

class P2PSyncService {
  private peer: any = null;
  private isHost: boolean = false;
  private stationId: string = '';
  private hostConnection: any = null;
  private clientConnections: Map<string, any> = new Map();
  private incomingChunks: Map<string, { total: number; chunks: string[]; metadata?: any }> = new Map();
  private broadcastChannel: BroadcastChannel | null = null;

  private onOrderReceivedCallback?: (order: BusinessPrintOrder) => void;
  private onStatusChangeCallback?: (status: ConnectionStatus, message?: string) => void;
  private onOrderStatusUpdateCallback?: (orderId: string, status: PrintJobStatus) => void;
  private onConfigReceivedCallback?: (config: StationConfig) => void;

  private stationConfigProvider?: () => StationConfig;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          this.handleBroadcastMessage(event.data);
        };
      } catch (e) {
        console.warn('BroadcastChannel not supported or blocked:', e);
      }
    }
  }

  /**
   * Helper to safely instantiate Peer across ESM/CJS bundles
   */
  private createPeer(id?: string): any {
    const PeerClass = (Peer as any).Peer || Peer;
    if (id) {
      return new PeerClass(id, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
          ],
        },
      });
    }
    return new PeerClass({
      debug: 1,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
        ],
      },
    });
  }

  /**
   * ADMIN PC HOST INITIALIZATION
   * Binds the Shop Owner PC station as the WebRTC receiver for mobile uploads.
   */
  public initHost(
    stationId: string,
    configProvider: () => StationConfig,
    onOrderReceived: (order: BusinessPrintOrder) => void,
    onStatusChange: (status: ConnectionStatus, message?: string) => void
  ) {
    // Cleanup existing peer if stationId changed
    if (this.peer) {
      this.destroy();
    }

    this.isHost = true;
    this.stationId = stationId;
    this.stationConfigProvider = configProvider;
    this.onOrderReceivedCallback = onOrderReceived;
    this.onStatusChangeCallback = onStatusChange;

    this.onStatusChangeCallback?.('connecting', `Registering station: ${stationId}...`);

    try {
      this.peer = this.createPeer(stationId);

      this.peer.on('open', (id: string) => {
        console.log('[P2P Host] Station listening with ID:', id);
        this.onStatusChangeCallback?.('connected', `Station online: ${id}`);
      });

      this.peer.on('connection', (conn: any) => {
        console.log('[P2P Host] Customer connected:', conn.peer);
        this.clientConnections.set(conn.peer, conn);

        conn.on('open', () => {
          console.log('[P2P Host] Data channel open with customer:', conn.peer);
          // Automatically send current station configuration (rates, shop name)
          if (this.stationConfigProvider) {
            conn.send({
              type: 'config-response',
              config: this.stationConfigProvider(),
            });
          }
        });

        conn.on('data', (data: any) => {
          this.handleIncomingData(data, conn);
        });

        conn.on('close', () => {
          console.log('[P2P Host] Customer disconnected:', conn.peer);
          this.clientConnections.delete(conn.peer);
        });

        conn.on('error', (err: any) => {
          console.warn('[P2P Host] Customer connection error:', err);
        });
      });

      this.peer.on('error', (err: any) => {
        console.warn('[P2P Host] Peer error:', err);
        if (err.type === 'unavailable-id') {
          // If custom ID is momentarily taken, fallback with a suffix
          this.onStatusChangeCallback?.('error', `Station ID busy, try adding a digit`);
        } else {
          this.onStatusChangeCallback?.('error', err.message || 'P2P signaling error');
        }
      });

      this.peer.on('disconnected', () => {
        console.log('[P2P Host] Disconnected from signaling broker. Reconnecting...');
        this.peer?.reconnect();
      });
    } catch (e: any) {
      console.error('[P2P Host] Failed to initialize host peer:', e);
      this.onStatusChangeCallback?.('error', e.message || 'Initialization failed');
    }
  }

  /**
   * CUSTOMER MOBILE CLIENT INITIALIZATION
   * Connects customer phone to the shop's Admin PC station.
   */
  public connectClient(
    stationId: string,
    onStatusChange: (status: ConnectionStatus, message?: string) => void,
    onConfigReceived?: (config: StationConfig) => void,
    onOrderStatusUpdate?: (orderId: string, status: PrintJobStatus) => void
  ) {
    if (this.peer) {
      this.destroy();
    }

    this.isHost = false;
    this.stationId = stationId;
    this.onStatusChangeCallback = onStatusChange;
    this.onConfigReceivedCallback = onConfigReceived;
    this.onOrderStatusUpdateCallback = onOrderStatusUpdate;

    this.onStatusChangeCallback?.('connecting', `Connecting to shop station ${stationId}...`);

    try {
      this.peer = this.createPeer();

      this.peer.on('open', (myId: string) => {
        console.log('[P2P Client] Mobile phone ready with ephemeral ID:', myId);
        this.attemptConnectToHost(stationId);
      });

      this.peer.on('error', (err: any) => {
        console.warn('[P2P Client] Peer error:', err);
        this.onStatusChangeCallback?.('error', 'Could not link to shop PC. Local fallback active.');
      });
    } catch (e: any) {
      console.error('[P2P Client] Failed to initialize client peer:', e);
      this.onStatusChangeCallback?.('error', e.message || 'Client initialization failed');
    }
  }

  private attemptConnectToHost(stationId: string) {
    if (!this.peer) return;

    try {
      const conn = this.peer.connect(stationId, {
        reliable: true,
      });

      this.hostConnection = conn;

      conn.on('open', () => {
        console.log('[P2P Client] Connected directly to Shop PC station!');
        this.onStatusChangeCallback?.('connected', 'Connected to Shop PC Printer');
        conn.send({ type: 'request-config' });
      });

      conn.on('data', (data: any) => {
        this.handleIncomingData(data, conn);
      });

      conn.on('close', () => {
        console.log('[P2P Client] Connection to shop PC closed');
        this.onStatusChangeCallback?.('disconnected', 'Shop PC connection closed');
      });

      conn.on('error', (err: any) => {
        console.warn('[P2P Client] Host connection error:', err);
      });
    } catch (e) {
      console.warn('[P2P Client] Failed to connect to host:', e);
    }
  }

  /**
   * Handle incoming messages on both Host and Client
   */
  private handleIncomingData(data: any, conn: any) {
    if (!data || typeof data !== 'object') return;
    const msg = data as SyncMessage;

    switch (msg.type) {
      case 'request-config':
        if (this.isHost && this.stationConfigProvider) {
          conn.send({
            type: 'config-response',
            config: this.stationConfigProvider(),
          });
        }
        break;

      case 'config-response':
        if (!this.isHost && this.onConfigReceivedCallback) {
          this.onConfigReceivedCallback(msg.config);
        }
        break;

      case 'order-chunk':
        this.handleOrderChunk(msg, conn);
        break;

      case 'order-ack':
        console.log('[P2P Client] Order confirmed by Shop PC:', msg.ticketNumber);
        if (this.onOrderStatusUpdateCallback) {
          this.onOrderStatusUpdateCallback(msg.orderId, msg.status);
        }
        break;

      case 'status-update':
        if (this.onOrderStatusUpdateCallback) {
          this.onOrderStatusUpdateCallback(msg.orderId, msg.status);
        }
        break;

      case 'ping':
        conn.send({ type: 'pong' });
        break;
    }
  }

  /**
   * Reassemble chunked file orders from WebRTC DataChannel
   */
  private handleOrderChunk(msg: OrderChunkMessage, conn: any) {
    const { orderId, chunkIndex, totalChunks, chunkData, metadata } = msg;

    if (!this.incomingChunks.has(orderId)) {
      this.incomingChunks.set(orderId, {
        total: totalChunks,
        chunks: new Array(totalChunks),
        metadata: metadata,
      });
    }

    const state = this.incomingChunks.get(orderId)!;
    state.chunks[chunkIndex] = chunkData;
    if (metadata) {
      state.metadata = metadata;
    }

    // Check if all chunks received
    const isComplete = state.chunks.filter(Boolean).length === totalChunks;
    if (isComplete && state.metadata) {
      const fullDataUrl = state.chunks.join('');
      const completeOrder: BusinessPrintOrder = {
        ...state.metadata,
        fileData: {
          ...state.metadata.fileData,
          dataUrl: fullDataUrl,
        },
      };

      this.incomingChunks.delete(orderId);
      console.log('[P2P Host] Full order reassembled! Ticket:', completeOrder.ticketNumber);

      // Acknowledge back to customer phone
      conn.send({
        type: 'order-ack',
        orderId: completeOrder.id,
        ticketNumber: completeOrder.ticketNumber,
        status: completeOrder.status,
      });

      // Save to Host localStorage for durability on PC
      this.persistOrderLocally(completeOrder);

      // Trigger Host UI update
      if (this.onOrderReceivedCallback) {
        this.onOrderReceivedCallback(completeOrder);
      }
    }
  }

  /**
   * Persists orders to browser localStorage on Admin PC
   */
  public persistOrderLocally(order: BusinessPrintOrder) {
    if (typeof window === 'undefined') return;
    try {
      const existing = localStorage.getItem('station_received_orders');
      const list: BusinessPrintOrder[] = existing ? JSON.parse(existing) : [];
      // Keep most recent 50 orders
      const updated = [order, ...list.filter((o) => o.id !== order.id)].slice(0, 50);
      localStorage.setItem('station_received_orders', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not persist order to localStorage:', e);
    }
  }

  public getPersistedOrders(): BusinessPrintOrder[] {
    if (typeof window === 'undefined') return [];
    try {
      const existing = localStorage.getItem('station_received_orders');
      if (!existing) return [];
      const list: BusinessPrintOrder[] = JSON.parse(existing);
      return list.map((order) => ({
        ...order,
        copies: typeof order.copies === 'number' && order.copies > 0 ? order.copies : 1,
        estimatedPrice:
          typeof order.estimatedPrice === 'number' && !isNaN(order.estimatedPrice)
            ? order.estimatedPrice
            : 0,
        isPaid: Boolean(order.isPaid),
        status: order.status || 'queued',
      }));
    } catch (e) {
      return [];
    }
  }

  /**
   * SEND ORDER FROM CUSTOMER MOBILE TO ADMIN PC
   * Supports WebRTC P2P direct transmission + BroadcastChannel + REST API fallback.
   */
  public async sendOrder(order: BusinessPrintOrder): Promise<{ success: boolean; method: string }> {
    let sentP2P = false;

    // 1. Send via WebRTC DataChannel (Direct P2P)
    if (this.hostConnection && this.hostConnection.open) {
      try {
        const dataUrl = order.fileData.dataUrl || '';
        const totalChunks = Math.max(1, Math.ceil(dataUrl.length / CHUNK_SIZE));

        const { dataUrl: _, ...fileMeta } = order.fileData;
        const metadata = {
          ...order,
          fileData: fileMeta,
        };

        for (let i = 0; i < totalChunks; i++) {
          const chunkData = dataUrl.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const chunkMsg: OrderChunkMessage = {
            type: 'order-chunk',
            orderId: order.id,
            chunkIndex: i,
            totalChunks,
            chunkData,
            metadata: i === 0 ? metadata : undefined,
          };
          this.hostConnection.send(chunkMsg);
        }
        sentP2P = true;
        console.log('[P2P Client] Sent order to Admin PC via WebRTC DataChannel!');
      } catch (err) {
        console.warn('[P2P Client] WebRTC send failed, trying fallbacks:', err);
      }
    }

    // 2. BroadcastChannel (works between tabs / same device or local test)
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'new-order',
          order,
        });
      } catch (e) {
        console.warn('BroadcastChannel send error:', e);
      }
    }

    // 3. REST API fallback (when hosted with Node.js Express server)
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      if (response.ok) {
        return { success: true, method: sentP2P ? 'webrtc-and-api' : 'api' };
      }
    } catch (e) {
      // Offline / Netlify static mode where /api/orders does not exist - completely normal
    }

    if (sentP2P) {
      return { success: true, method: 'webrtc' };
    }

    // Fallback: save to localStorage if opened on same domain
    this.persistOrderLocally(order);
    return { success: true, method: 'local' };
  }

  /**
   * ADMIN PC SENDS STATUS UPDATE (e.g. 'printing' or 'completed')
   */
  public updateOrderStatus(orderId: string, status: PrintJobStatus) {
    // 1. Update local storage
    if (typeof window !== 'undefined') {
      try {
        const orders = this.getPersistedOrders();
        const updated = orders.map((o) => (o.id === orderId ? { ...o, status } : o));
        localStorage.setItem('station_received_orders', JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
    }

    // 2. Send to all connected customer phones
    const msg: OrderStatusUpdateMessage = {
      type: 'status-update',
      orderId,
      status,
    };

    this.clientConnections.forEach((conn) => {
      if (conn.open) {
        try {
          conn.send(msg);
        } catch (e) {
          // ignore
        }
      }
    });

    // 3. Send over BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch (e) {
        // ignore
      }
    }

    // 4. REST API fallback
    fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  }

  private handleBroadcastMessage(msg: any) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'new-order' && this.isHost && this.onOrderReceivedCallback) {
      this.onOrderReceivedCallback(msg.order);
    } else if (msg.type === 'status-update' && !this.isHost && this.onOrderStatusUpdateCallback) {
      this.onOrderStatusUpdateCallback(msg.orderId, msg.status);
    }
  }

  public destroy() {
    this.clientConnections.forEach((conn) => conn.close());
    this.clientConnections.clear();
    if (this.hostConnection) {
      this.hostConnection.close();
      this.hostConnection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.incomingChunks.clear();
  }
}

export const p2pSync = new P2PSyncService();
