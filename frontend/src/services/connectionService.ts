/**
 * Connection Service Stub
 * TODO: Migrate to SocketClient pattern
 * This is a temporary stub to unblock compilation
 */

export interface ConnectionState {
  status: 'connected' | 'reconnecting' | 'disconnected';
  latency: number | null;
  lastConnected: Date | null;
  reconnectAttempts: number;
}

export interface UseConnectionReturn {
  connectionState: ConnectionState;
  forceReconnect: () => void;
}

type ConnectionListener = (state: ConnectionState) => void;

class ConnectionMonitor {
  private state: ConnectionState = {
    status: 'disconnected',
    latency: null,
    lastConnected: null,
    reconnectAttempts: 0,
  };

  private listeners: Set<ConnectionListener> = new Set();
  private channels: Map<string, any> = new Map();

  getConnectionState(): ConnectionState {
    return { ...this.state };
  }

  addListener(listener: ConnectionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  forceReconnect(): void {
    // In new architecture, SocketClient handles reconnection
    console.log('ConnectionMonitor: forceReconnect called (stub)');
  }

  registerChannel(channelId: string, channel: any): void {
    this.channels.set(channelId, channel);
  }

  unregisterChannel(channelId: string): void {
    this.channels.delete(channelId);
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  // For testing purposes
  updateState(newState: Partial<ConnectionState>): void {
    this.state = { ...this.state, ...newState };
    this.notifyListeners();
  }
}

export const connectionMonitor = new ConnectionMonitor();
