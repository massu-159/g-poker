/**
 * Connection Monitoring Service for G-Poker
 * Monitors real-time connection status and handles reconnection logic
 */

import { RealtimeChannel, REALTIME_POSTGRES_CHANGES_LISTEN_EVENT } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface ConnectionState {
  status: ConnectionStatus;
  lastConnected: Date | null;
  reconnectAttempts: number;
  latency: number | null;
}

export interface ConnectionListener {
  (state: ConnectionState): void;
}

export class ConnectionMonitor {
  private static instance: ConnectionMonitor;
  private connectionState: ConnectionState;
  private listeners: ConnectionListener[] = [];
  private activeChannels: Map<string, RealtimeChannel> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatChannel: RealtimeChannel | null = null;

  // Configuration
  private readonly HEARTBEAT_INTERVAL = 10000; // 10 seconds
  private readonly RECONNECT_DELAY = 2000; // 2 seconds
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly CONNECTION_TIMEOUT = 15000; // 15 seconds

  private constructor() {
    this.connectionState = {
      status: 'disconnected',
      lastConnected: null,
      reconnectAttempts: 0,
      latency: null,
    };

    this.initializeMonitoring();
  }

  static getInstance(): ConnectionMonitor {
    if (!ConnectionMonitor.instance) {
      ConnectionMonitor.instance = new ConnectionMonitor();
    }
    return ConnectionMonitor.instance;
  }

  private initializeMonitoring() {
    // Start heartbeat monitoring
    this.startHeartbeat();

    // Monitor global connection state
    this.setupGlobalConnectionListener();
  }

  private setupGlobalConnectionListener() {
    // Create a dedicated heartbeat channel
    this.heartbeatChannel = supabase.channel('connection-heartbeat');

    this.heartbeatChannel
      .on('presence', { event: 'sync' }, () => {
        this.handleConnectionEvent('connected');
      })
      .subscribe((status) => {
        console.log('🔗 Connection heartbeat status:', status);

        switch (status) {
          case 'SUBSCRIBED':
            this.handleConnectionEvent('connected');
            break;
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
          case 'CLOSED':
            this.handleConnectionEvent('disconnected');
            break;
        }
      });
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, this.HEARTBEAT_INTERVAL);
  }

  private async performHeartbeat() {
    const startTime = Date.now();

    try {
      // Simple presence sync to test connection
      if (this.heartbeatChannel) {
        await this.heartbeatChannel.track({ heartbeat: true });

        const latency = Date.now() - startTime;
        this.updateConnectionState({
          status: 'connected',
          latency,
          lastConnected: new Date(),
          reconnectAttempts: 0,
        });
      }
    } catch (error) {
      console.error('🔗 Heartbeat failed:', error);
      this.handleConnectionEvent('disconnected');
    }
  }

  private handleConnectionEvent(event: 'connected' | 'disconnected') {
    console.log('🔗 Connection event:', event);

    switch (event) {
      case 'connected':
        this.updateConnectionState({
          status: 'connected',
          lastConnected: new Date(),
          reconnectAttempts: 0,
        });
        break;

      case 'disconnected':
        if (this.connectionState.status !== 'disconnected') {
          this.updateConnectionState({
            status: 'disconnected',
            latency: null,
          });
          this.attemptReconnection();
        }
        break;
    }
  }

  private attemptReconnection() {
    if (this.connectionState.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.log('🔗 Max reconnection attempts reached');
      return;
    }

    this.updateConnectionState({
      status: 'reconnecting',
      reconnectAttempts: this.connectionState.reconnectAttempts + 1,
    });

    // Clear existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Exponential backoff for reconnection
    const delay = this.RECONNECT_DELAY * Math.pow(2, this.connectionState.reconnectAttempts);

    this.reconnectTimeout = setTimeout(async () => {
      console.log(`🔗 Attempting reconnection (${this.connectionState.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`);

      try {
        // Reconnect all active channels
        await this.reconnectAllChannels();

        // Reset heartbeat
        this.setupGlobalConnectionListener();

      } catch (error) {
        console.error('🔗 Reconnection failed:', error);
        this.attemptReconnection();
      }
    }, delay);
  }

  private async reconnectAllChannels() {
    console.log('🔗 Reconnecting all active channels...');

    // Unsubscribe and resubscribe all channels
    for (const [channelId, channel] of this.activeChannels) {
      try {
        await channel.unsubscribe();
        // Note: Actual resubscription will be handled by the consuming components
        console.log(`🔗 Unsubscribed channel: ${channelId}`);
      } catch (error) {
        console.error(`🔗 Failed to unsubscribe channel ${channelId}:`, error);
      }
    }

    // Clear the active channels map - they'll be re-registered when components resubscribe
    this.activeChannels.clear();
  }

  private updateConnectionState(updates: Partial<ConnectionState>) {
    this.connectionState = {
      ...this.connectionState,
      ...updates,
    };

    console.log('🔗 Connection state updated:', this.connectionState);

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.connectionState);
      } catch (error) {
        console.error('🔗 Connection listener error:', error);
      }
    });
  }

  // Public API
  public getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  public addListener(listener: ConnectionListener): () => void {
    this.listeners.push(listener);

    // Immediately call with current state
    listener(this.connectionState);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public registerChannel(channelId: string, channel: RealtimeChannel) {
    console.log(`🔗 Registering channel: ${channelId}`);
    this.activeChannels.set(channelId, channel);

    // Monitor this specific channel for connection events
    this.setupChannelMonitoring(channelId, channel);
  }

  public unregisterChannel(channelId: string) {
    console.log(`🔗 Unregistering channel: ${channelId}`);
    this.activeChannels.delete(channelId);
  }

  private setupChannelMonitoring(channelId: string, channel: RealtimeChannel) {
    // Add error handling to the channel
    const originalSubscribe = channel.subscribe.bind(channel);

    channel.subscribe = (callback?: (status: any) => void) => {
      return originalSubscribe((status) => {
        console.log(`🔗 Channel ${channelId} status:`, status);

        switch (status) {
          case 'SUBSCRIBED':
            this.handleConnectionEvent('connected');
            break;
          case 'CHANNEL_ERROR':
          case 'TIMED_OUT':
          case 'CLOSED':
            this.handleConnectionEvent('disconnected');
            break;
        }

        // Call original callback if provided
        if (callback) {
          callback(status);
        }
      });
    };
  }

  public forceReconnect() {
    console.log('🔗 Force reconnection requested');
    this.handleConnectionEvent('disconnected');
  }

  public cleanup() {
    // Clear intervals and timeouts
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Unsubscribe heartbeat channel
    if (this.heartbeatChannel) {
      this.heartbeatChannel.unsubscribe();
      this.heartbeatChannel = null;
    }

    // Clear all active channels
    this.activeChannels.clear();

    // Clear listeners
    this.listeners = [];
  }
}

// Export singleton instance
export const connectionMonitor = ConnectionMonitor.getInstance();

// Helper hook for React components
export interface UseConnectionReturn {
  connectionState: ConnectionState;
  forceReconnect: () => void;
}

// This will be used by React components to monitor connection
export function createConnectionHook() {
  return {
    useConnection: (): UseConnectionReturn => {
      // This will be implemented as a proper React hook when integrated
      // For now, return current state
      return {
        connectionState: connectionMonitor.getConnectionState(),
        forceReconnect: () => connectionMonitor.forceReconnect(),
      };
    }
  };
}