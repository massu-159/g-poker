/**
 * React Hook for Connection Monitoring
 * Provides real-time connection status for React components
 */

import { useState, useEffect, useCallback } from 'react';
import { connectionMonitor, ConnectionState, UseConnectionReturn } from '@/services/connectionService';

/**
 * Hook to monitor connection status and provide connection controls
 */
export function useConnection(): UseConnectionReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    connectionMonitor.getConnectionState()
  );

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribe = connectionMonitor.addListener((newState) => {
      setConnectionState(newState);
    });

    return unsubscribe;
  }, []);

  const forceReconnect = useCallback(() => {
    connectionMonitor.forceReconnect();
  }, []);

  return {
    connectionState,
    forceReconnect,
  };
}

/**
 * Hook for game components to register their real-time channels
 * This ensures connection monitoring covers all active subscriptions
 */
export function useGameConnection(gameId: string) {
  const connection = useConnection();

  const registerChannel = useCallback((channelId: string, channel: any) => {
    connectionMonitor.registerChannel(channelId, channel);
  }, []);

  const unregisterChannel = useCallback((channelId: string) => {
    connectionMonitor.unregisterChannel(channelId);
  }, []);

  // Auto-register game channel when gameId changes
  useEffect(() => {
    const channelId = `game-connection-${gameId}`;

    return () => {
      unregisterChannel(channelId);
    };
  }, [gameId, unregisterChannel]);

  return {
    ...connection,
    registerChannel,
    unregisterChannel,
  };
}

/**
 * Hook to get simple connection status for UI components
 */
export function useConnectionStatus() {
  const { connectionState } = useConnection();

  return {
    isConnected: connectionState.status === 'connected',
    isReconnecting: connectionState.status === 'reconnecting',
    isDisconnected: connectionState.status === 'disconnected',
    status: connectionState.status,
    latency: connectionState.latency,
    lastConnected: connectionState.lastConnected,
    reconnectAttempts: connectionState.reconnectAttempts,
  };
}