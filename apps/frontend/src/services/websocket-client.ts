import { io, Socket } from 'socket.io-client';
import type { WSEventType, WSMessage, WSAuthMessage } from '@cronos-x402/shared-types';

type EventHandler = (data: any) => void;

export class WebSocketClient {
  private socket: Socket | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isAuthenticated = false;

  constructor(
    private url: string,
    private address?: string
  ) {}

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    this.socket = io(this.url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      timeout: 20000,
    });

    this.setupEventListeners();
    console.log('[WebSocket] Connecting to', this.url);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isAuthenticated = false;
      console.log('[WebSocket] Disconnected');
    }
  }

  /**
   * Authenticate with WebSocket server
   */
  authenticate(address: string, token: string = ''): void {
    if (!this.socket?.connected) {
      console.error('[WebSocket] Not connected');
      return;
    }

    const authMessage: WSAuthMessage = {
      type: 'auth',
      token,
      address,
    };

    this.socket.emit('auth', authMessage);
    this.address = address;
  }

  /**
   * Send an event to the server
   */
  emit(event: WSEventType, data: any): void {
    if (!this.socket?.connected) {
      console.error('[WebSocket] Not connected');
      return;
    }

    const message: WSMessage = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    this.socket.emit(event, message);
  }

  /**
   * Subscribe to an event
   */
  on(event: WSEventType | string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    // Register with socket if connected
    if (this.socket) {
      this.socket.on(event, handler);
    }
  }

  /**
   * Unsubscribe from an event
   */
  off(event: WSEventType | string, handler?: EventHandler): void {
    if (handler) {
      this.eventHandlers.get(event)?.delete(handler);
      this.socket?.off(event, handler);
    } else {
      this.eventHandlers.delete(event);
      this.socket?.off(event);
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Check if authenticated
   */
  isAuth(): boolean {
    return this.isAuthenticated;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      this.reconnectAttempts = 0;

      // Auto-authenticate if address is available
      if (this.address) {
        this.authenticate(this.address);
      }

      this.notifyHandlers('connect', {});
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      this.isAuthenticated = false;
      this.notifyHandlers('disconnect', { reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnect attempts reached');
        this.socket?.disconnect();
      }
    });

    // Authentication events
    this.socket.on('auth:success', (data) => {
      console.log('[WebSocket] Authenticated', data);
      this.isAuthenticated = true;
      this.notifyHandlers('auth:success', data);
    });

    this.socket.on('auth:error', (error) => {
      console.error('[WebSocket] Authentication failed:', error);
      this.isAuthenticated = false;
      this.notifyHandlers('auth:error', error);
    });

    // Ping/Pong
    this.socket.on('pong', (data) => {
      this.notifyHandlers('pong', data);
    });

    // Register all existing event handlers
    this.eventHandlers.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        this.socket!.on(event, handler);
      });
    });
  }

  /**
   * Notify all handlers for an event
   */
  private notifyHandlers(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[WebSocket] Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Send ping to server
   */
  ping(): void {
    this.emit('ping' as WSEventType, {});
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null;

/**
 * Get or create WebSocket client instance
 */
export function getWebSocketClient(address?: string): WebSocketClient {
  const url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

  if (!wsClient) {
    wsClient = new WebSocketClient(url, address);
  }

  return wsClient;
}

/**
 * Reset WebSocket client (for testing)
 */
export function resetWebSocketClient(): void {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
}
