/**
 * Realtime Subscription Hooks
 * Custom React hooks for managing Supabase realtime subscriptions
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { realtimeService } from '../services/realtimeService';
import { useGameStore, ConnectionStatus } from '../stores/gameStore';
import { useUserStore } from '../stores/userStore';
import type { 
  GameStateChangeEvent, 
  PlayerActionEvent, 
  RoundUpdateEvent,
  PlayerAuth,
  RealtimeEventHandlers
} from '../services/realtimeService';

// Connection state for realtime subscriptions
export interface RealtimeConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastHeartbeat: string | null;
  subscriptionCount: number;
}

// Hook for managing game realtime subscriptions
export const useGameRealtimeSubscription = (gameId: string | null) => {
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    lastHeartbeat: null,
    subscriptionCount: 0
  });

  const handleServerStateSync = useGameStore(state => state.handleServerStateSync);
  const handlePlayerAction = useGameStore(state => state.handlePlayerAction);
  const handleRoundUpdate = useGameStore(state => state.handleRoundUpdate);
  const setConnectionStatus = useGameStore(state => state.setConnectionStatus);
  const currentPlayer = useUserStore(state => state.currentPlayer);
  
  const subscriptionRef = useRef<(() => void) | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Event handlers
  const eventHandlers: RealtimeEventHandlers = {
    onGameStateChange: useCallback((event: GameStateChangeEvent) => {
      console.log('Game state change received:', event.gameId);
      handleServerStateSync(event.gameState as any);
      setConnectionState(prev => ({
        ...prev,
        lastHeartbeat: new Date().toISOString()
      }));
    }, [handleServerStateSync]),

    onPlayerAction: useCallback((event: PlayerActionEvent) => {
      console.log('Player action received:', event.playerId, event.actionType);
      handlePlayerAction(event);
      setConnectionState(prev => ({
        ...prev,
        lastHeartbeat: new Date().toISOString()
      }));
    }, [handlePlayerAction]),

    onRoundUpdate: useCallback((event: RoundUpdateEvent) => {
      console.log('Round update received:', event.gameId);
      handleRoundUpdate(event);
      setConnectionState(prev => ({
        ...prev,
        lastHeartbeat: new Date().toISOString()
      }));
    }, [handleRoundUpdate]),

    onError: useCallback((error: any) => {
      console.error('Realtime subscription error:', error);
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        error: error.message || 'Realtime connection error'
      }));
      setConnectionStatus(ConnectionStatus.ERROR);
    }, [setConnectionStatus])
  };

  // Subscribe to game updates
  const subscribeToGame = useCallback(async (gameId: string, playerAuth: PlayerAuth) => {
    if (subscriptionRef.current) {
      subscriptionRef.current(); // Cleanup existing subscription
    }

    try {
      setConnectionState(prev => ({
        ...prev,
        isConnecting: true,
        error: null
      }));

      const result = await realtimeService.subscribeToGame(gameId, playerAuth, eventHandlers);
      
      if (result.success && result.data) {
        subscriptionRef.current = () => result.data!.channel.unsubscribe();
      } else {
        throw new Error(result.error?.message || 'Subscription failed');
      }
      
      setConnectionState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        subscriptionCount: prev.subscriptionCount + 1
      }));

      setConnectionStatus(ConnectionStatus.CONNECTED);

      return subscriptionRef.current;
    } catch (error) {
      console.error('Failed to subscribe to game:', error);
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Subscription failed'
      }));
      setConnectionStatus(ConnectionStatus.ERROR);
      throw error;
    }
  }, [eventHandlers, setConnectionStatus]);

  // Cleanup subscription
  const unsubscribeFromGame = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current();
      subscriptionRef.current = null;
      
      setConnectionState(prev => ({
        ...prev,
        isConnected: false,
        subscriptionCount: Math.max(0, prev.subscriptionCount - 1)
      }));

      setConnectionStatus(ConnectionStatus.DISCONNECTED);
    }
  }, [setConnectionStatus]);

  // Auto-subscribe when game ID and player are available
  useEffect(() => {
    if (gameId && currentPlayer?.deviceId) {
      const playerAuth: PlayerAuth = {
        deviceId: currentPlayer.deviceId
      };

      subscribeToGame(gameId, playerAuth).catch(error => {
        console.error('Auto-subscription failed:', error);
      });

      return () => {
        unsubscribeFromGame();
      };
    }
    
    return undefined;
  }, [gameId, currentPlayer?.deviceId, subscribeToGame, unsubscribeFromGame]);

  // Setup heartbeat monitoring
  useEffect(() => {
    if (connectionState.isConnected) {
      heartbeatRef.current = setInterval(() => {
        const now = new Date();
        const lastHeartbeat = connectionState.lastHeartbeat ? new Date(connectionState.lastHeartbeat) : null;
        
        // If no heartbeat for 30 seconds, consider connection stale
        if (lastHeartbeat && (now.getTime() - lastHeartbeat.getTime()) > 30000) {
          setConnectionState(prev => ({
            ...prev,
            error: 'Connection appears stale'
          }));
          setConnectionStatus(ConnectionStatus.RECONNECTING);
        }
      }, 10000); // Check every 10 seconds

      return () => {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
      };
    }
    
    return undefined;
  }, [connectionState.isConnected, connectionState.lastHeartbeat, setConnectionStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubscribeFromGame();
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, [unsubscribeFromGame]);

  return {
    connectionState,
    subscribeToGame,
    unsubscribeFromGame,
    isConnected: connectionState.isConnected,
    isConnecting: connectionState.isConnecting,
    error: connectionState.error
  };
};

// Hook for managing app state and realtime subscriptions
export const useAppStateRealtimeManager = () => {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const gameId = useGameStore(state => state.game?.id);
  const setConnectionStatus = useGameStore(state => state.setConnectionStatus);
  
  const { subscribeToGame, unsubscribeFromGame, connectionState } = useGameRealtimeSubscription(gameId || null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('App state changed:', appState, '->', nextAppState);
      
      if (appState.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - reconnect to realtime
        console.log('App became active, reconnecting realtime subscriptions');
        setConnectionStatus(ConnectionStatus.RECONNECTING);
        
        // Attempt to resubscribe after a short delay
        setTimeout(() => {
          if (gameId) {
            // The useGameRealtimeSubscription hook will handle reconnection
          }
        }, 1000);
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background - maintain connection but reduce activity
        console.log('App went to background, maintaining passive connection');
      }
      
      setAppState(nextAppState);
    });

    return () => subscription?.remove();
  }, [appState, gameId, setConnectionStatus]);

  return {
    appState,
    isAppActive: appState === 'active',
    connectionState
  };
};

// Hook for player presence tracking
export const usePlayerPresence = (gameId: string | null) => {
  const [playerPresence, setPlayerPresence] = useState<Record<string, boolean>>({});
  const currentPlayer = useUserStore(state => state.currentPlayer);

  // Subscribe to player presence updates
  useEffect(() => {
    if (!gameId || !currentPlayer) return;

    let unsubscribe: (() => void) | null = null;

    const setupPresenceTracking = async () => {
      try {
        unsubscribe = await realtimeService.subscribeToPlayerPresence(gameId, {
          onPlayerOnline: (playerId: string) => {
            console.log('Player came online:', playerId);
            setPlayerPresence(prev => ({
              ...prev,
              [playerId]: true
            }));
          },
          onPlayerOffline: (playerId: string) => {
            console.log('Player went offline:', playerId);
            setPlayerPresence(prev => ({
              ...prev,
              [playerId]: false
            }));
          }
        });
      } catch (error) {
        console.error('Failed to setup presence tracking:', error);
      }
    };

    setupPresenceTracking();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [gameId, currentPlayer]);

  const isPlayerOnline = useCallback((playerId: string) => {
    return playerPresence[playerId] === true;
  }, [playerPresence]);

  return {
    playerPresence,
    isPlayerOnline
  };
};

// Hook for connection quality monitoring
export const useConnectionQuality = () => {
  const [connectionMetrics, setConnectionMetrics] = useState({
    latency: null as number | null,
    packetLoss: 0,
    reconnectCount: 0,
    lastDisconnect: null as string | null
  });

  const connectionStatus = useGameStore(state => state.connectionStatus);

  // Monitor connection quality
  useEffect(() => {
    let reconnectCount = 0;
    let lastConnectedTime: number | null = null;

    const startMonitoring = () => {
      // Simple latency monitoring via periodic pings
      const pingInterval = setInterval(async () => {
        const startTime = Date.now();
        
        try {
          // Use a lightweight Supabase operation to measure latency
          await realtimeService.ping();
          const latency = Date.now() - startTime;
          
          setConnectionMetrics(prev => ({
            ...prev,
            latency
          }));
        } catch (error) {
          console.warn('Connection ping failed:', error);
        }
      }, 15000); // Ping every 15 seconds

      return () => clearInterval(pingInterval);
    };

    let cleanup: (() => void) | null = null;

    if (connectionStatus === 'connected') {
      lastConnectedTime = Date.now();
      cleanup = startMonitoring();
    } else if (connectionStatus === 'reconnecting' && lastConnectedTime) {
      reconnectCount++;
      setConnectionMetrics(prev => ({
        ...prev,
        reconnectCount: prev.reconnectCount + 1,
        lastDisconnect: new Date().toISOString()
      }));
    }

    return cleanup || undefined;
  }, [connectionStatus]);

  const getConnectionQuality = useCallback(() => {
    const { latency, packetLoss, reconnectCount } = connectionMetrics;
    
    if (connectionStatus !== 'connected') {
      return 'poor';
    }
    
    if (latency === null) {
      return 'unknown';
    }
    
    if (latency < 100 && packetLoss < 1 && reconnectCount < 3) {
      return 'excellent';
    } else if (latency < 300 && packetLoss < 5 && reconnectCount < 5) {
      return 'good';
    } else if (latency < 1000 && packetLoss < 10 && reconnectCount < 10) {
      return 'fair';
    } else {
      return 'poor';
    }
  }, [connectionMetrics, connectionStatus]);

  return {
    connectionMetrics,
    connectionQuality: getConnectionQuality()
  };
};