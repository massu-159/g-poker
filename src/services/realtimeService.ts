/**
 * Realtime Service
 * Manages WebSocket subscriptions for game events, player presence, and real-time synchronization
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { createGameChannel } from './supabase';
import { PlayerAuth } from '../lib/entities/Player';

// Re-export PlayerAuth for convenience
export type { PlayerAuth };

// Realtime event types
export interface GameStateChangeEvent {
  type: 'game_state_change';
  gameId: string;
  gameState: any;
  updatedBy: string;
  timestamp: string;
}

export interface PlayerActionEvent {
  type: 'player_action';
  gameId: string;
  actionType: string;
  playerId: string;
  actionData: any;
  timestamp: string;
  sequenceNumber: number;
}

export interface PlayerPresenceEvent {
  type: 'player_presence';
  gameId: string;
  playerId: string;
  isOnline: boolean;
  lastSeen: string;
}

export interface RoundUpdateEvent {
  type: 'round_update';
  gameId: string;
  round: any;
  updatedBy: string;
  timestamp: string;
}

export interface GameEndEvent {
  type: 'game_end';
  gameId: string;
  winnerId?: string;
  reason: string;
  timestamp: string;
}

export type RealtimeEvent = 
  | GameStateChangeEvent
  | PlayerActionEvent
  | PlayerPresenceEvent
  | RoundUpdateEvent
  | GameEndEvent;

// Subscription callbacks
export interface GameSubscriptionCallbacks {
  onGameStateChange?: (event: GameStateChangeEvent) => void;
  onPlayerAction?: (event: PlayerActionEvent) => void;
  onPlayerPresence?: (event: PlayerPresenceEvent) => void;
  onRoundUpdate?: (event: RoundUpdateEvent) => void;
  onGameEnd?: (event: GameEndEvent) => void;
  onOptimisticUpdate?: (event: any) => void;
  onServerStateSync?: (event: any) => void;
  onStateConflict?: (event: any) => void;
  onReconnection?: (event: any) => void;
  onStateRecovery?: (event: any) => void;
  onConflictResolution?: (event: any) => void;
  onError?: (error: any) => void;
}

// Alias for React hooks
export type RealtimeEventHandlers = GameSubscriptionCallbacks;

// Subscription result
export interface SubscriptionResult {
  success: boolean;
  data?: {
    subscriptionId: string;
    channel: RealtimeChannel;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Presence state
export interface PlayerPresence {
  playerId: string;
  displayName: string;
  isOnline: boolean;
  lastSeen: string;
  deviceInfo?: {
    platform: string;
    appVersion: string;
  };
}

// Service result
export interface RealtimeServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * RealtimeService handles all WebSocket-based real-time communication
 */
export class RealtimeService {
  private subscriptions: Map<string, RealtimeChannel> = new Map();
  private presenceState: Map<string, PlayerPresence[]> = new Map();
  private connectionState = {
    isConnected: false,
    lastConnected: null as Date | null,
    reconnectAttempts: 0
  };

  /**
   * Subscribe to game events
   */
  async subscribeToGame(
    gameId: string,
    playerAuth: PlayerAuth,
    callbacks: GameSubscriptionCallbacks
  ): Promise<SubscriptionResult> {
    try {
      const subscriptionId = `game_${gameId}_${playerAuth.deviceId}`;

      // Check if already subscribed
      if (this.subscriptions.has(subscriptionId)) {
        return {
          success: false,
          error: {
            code: 'ALREADY_SUBSCRIBED',
            message: 'Already subscribed to this game'
          }
        };
      }

      // Create channel
      const channel = createGameChannel(gameId);

      // Set up presence tracking
      const presenceData = {
        player_id: playerAuth.deviceId,
        display_name: 'Player', // This should come from player data
        last_seen: new Date().toISOString(),
        device_info: {
          platform: 'mobile',
          app_version: '1.0.0'
        }
      };

      // Configure channel events
      channel
        // Game state changes
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        }, (payload) => {
          if (callbacks.onGameStateChange) {
            const event: GameStateChangeEvent = {
              type: 'game_state_change',
              gameId,
              gameState: payload.new,
              updatedBy: (payload.new as any)?.['updated_by'] || '',
              timestamp: new Date().toISOString()
            };
            callbacks.onGameStateChange(event);
          }
        })

        // Game actions
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'game_actions',
          filter: `game_id=eq.${gameId}`
        }, (payload) => {
          if (callbacks.onPlayerAction) {
            const actionData = payload.new as any;
            const event: PlayerActionEvent = {
              type: 'player_action',
              gameId,
              actionType: actionData['action_type'],
              playerId: actionData['player_id'],
              actionData: actionData['action_data'],
              timestamp: actionData['timestamp'],
              sequenceNumber: actionData['sequence_number']
            };
            callbacks.onPlayerAction(event);
          }
        })

        // Round updates
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'rounds',
          filter: `game_id=eq.${gameId}`
        }, (payload) => {
          if (callbacks.onRoundUpdate) {
            const event: RoundUpdateEvent = {
              type: 'round_update',
              gameId,
              round: payload.new || payload.old,
              updatedBy: (payload.new as any)?.['updated_by'] || '',
              timestamp: new Date().toISOString()
            };
            callbacks.onRoundUpdate(event);
          }
        })

        // Player presence
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const players: PlayerPresence[] = Object.values(presenceState)
            .flat()
            .map((presence: any) => ({
              playerId: presence.player_id,
              displayName: presence.display_name,
              isOnline: true,
              lastSeen: presence.last_seen,
              deviceInfo: presence.device_info
            }));

          this.presenceState.set(gameId, players);

          if (callbacks.onPlayerPresence) {
            players.forEach(player => {
              const event: PlayerPresenceEvent = {
                type: 'player_presence',
                gameId,
                playerId: player.playerId,
                isOnline: player.isOnline,
                lastSeen: player.lastSeen
              };
              callbacks.onPlayerPresence!(event);
            });
          }
        })

        .on('presence', { event: 'join' }, ({ newPresences }) => {
          if (newPresences) {
            newPresences.forEach((presence: any) => {
              if (callbacks.onPlayerPresence) {
                const event: PlayerPresenceEvent = {
                  type: 'player_presence',
                  gameId,
                  playerId: presence.player_id,
                  isOnline: true,
                  lastSeen: presence.last_seen
                };
                callbacks.onPlayerPresence(event);
              }
            });
          }
        })

        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          leftPresences.forEach((presence: any) => {
            if (callbacks.onPlayerPresence) {
              const event: PlayerPresenceEvent = {
                type: 'player_presence',
                gameId,
                playerId: presence.player_id,
                isOnline: false,
                lastSeen: new Date().toISOString()
              };
              callbacks.onPlayerPresence(event);
            }
          });
        });

      // Subscribe and track presence
      const status = await new Promise<string>((resolve) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Track presence
            channel.track(presenceData);
            resolve(status);
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            resolve(status);
          }
        });
      });

      if (status !== 'SUBSCRIBED') {
        return {
          success: false,
          error: {
            code: 'SUBSCRIPTION_FAILED',
            message: `Failed to subscribe: ${status}`
          }
        };
      }

      // Store subscription
      this.subscriptions.set(subscriptionId, channel);

      return {
        success: true,
        data: {
          subscriptionId,
          channel
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SUBSCRIPTION_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to subscribe'
        }
      };
    }
  }

  /**
   * Unsubscribe from game events
   */
  async unsubscribe(subscriptionData: { subscriptionId: string; channel: RealtimeChannel }): Promise<RealtimeServiceResult<void>> {
    try {
      const { subscriptionId, channel } = subscriptionData;

      // Remove presence and unsubscribe
      await channel.untrack();
      await channel.unsubscribe();

      // Remove from tracking
      this.subscriptions.delete(subscriptionId);

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UNSUBSCRIBE_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to unsubscribe'
        }
      };
    }
  }

  /**
   * Get current presence state for a game
   */
  getPresenceState(gameId: string): PlayerPresence[] {
    return this.presenceState.get(gameId) || [];
  }

  /**
   * Send a custom game event
   */
  async sendGameEvent(
    gameId: string,
    eventType: string,
    eventData: any
  ): Promise<RealtimeServiceResult<void>> {
    try {
      const channel = Array.from(this.subscriptions.values())
        .find(ch => ch.topic.includes(gameId));

      if (!channel) {
        return {
          success: false,
          error: {
            code: 'NO_SUBSCRIPTION',
            message: 'Not subscribed to this game'
          }
        };
      }

      await channel.send({
        type: 'broadcast',
        event: eventType,
        payload: {
          ...eventData,
          timestamp: new Date().toISOString()
        }
      });

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SEND_EVENT_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to send event'
        }
      };
    }
  }

  /**
   * Update player presence data
   */
  async updatePresence(
    gameId: string,
    playerAuth: PlayerAuth,
    presenceData: Partial<PlayerPresence>
  ): Promise<RealtimeServiceResult<void>> {
    try {
      const subscriptionId = `game_${gameId}_${playerAuth.deviceId}`;
      const channel = this.subscriptions.get(subscriptionId);

      if (!channel) {
        return {
          success: false,
          error: {
            code: 'NO_SUBSCRIPTION',
            message: 'Not subscribed to this game'
          }
        };
      }

      const updatedPresence = {
        player_id: playerAuth.deviceId,
        display_name: presenceData.displayName || 'Player',
        last_seen: new Date().toISOString(),
        device_info: presenceData.deviceInfo || {
          platform: 'mobile',
          app_version: '1.0.0'
        }
      };

      await channel.track(updatedPresence);

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UPDATE_PRESENCE_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to update presence'
        }
      };
    }
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(channel: RealtimeChannel): { connected: boolean; topic: string } {
    return {
      connected: channel.state === 'joined',
      topic: channel.topic
    };
  }

  /**
   * Simulate disconnection (for testing)
   */
  async simulateDisconnection(channel: RealtimeChannel): Promise<void> {
    // This would be implemented for testing purposes
    await channel.unsubscribe();
  }

  /**
   * Simulate reconnection (for testing)
   */
  async simulateReconnection(channel: RealtimeChannel): Promise<void> {
    // This would be implemented for testing purposes
    channel.subscribe();
  }

  /**
   * Simulate network interruption (for testing)
   */
  async simulateNetworkInterruption(channel: RealtimeChannel): Promise<void> {
    // Temporary disconnect and reconnect
    await channel.unsubscribe();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    channel.subscribe();
  }

  /**
   * Get connection state
   */
  getConnectionState() {
    return { ...this.connectionState };
  }

  /**
   * Check if connected to a specific game
   */
  isConnectedToGame(gameId: string, playerAuth: PlayerAuth): boolean {
    const subscriptionId = `game_${gameId}_${playerAuth.deviceId}`;
    const channel = this.subscriptions.get(subscriptionId);
    
    return channel ? channel.state === 'joined' : false;
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): { gameId: string; status: string }[] {
    return Array.from(this.subscriptions.entries()).map(([id, channel]) => ({
      gameId: id.split('_')[1] || '',
      status: channel.state
    }));
  }

  /**
   * Cleanup all subscriptions
   */
  async cleanup(): Promise<void> {
    const unsubscribePromises = Array.from(this.subscriptions.values())
      .map(channel => channel.unsubscribe());

    await Promise.all(unsubscribePromises);
    this.subscriptions.clear();
    this.presenceState.clear();
  }

  /**
   * Handle optimistic updates (for responsive UI)
   */
  handleOptimisticUpdate(gameId: string, updateData: any, callback?: (event: any) => void) {
    if (callback) {
      const event = {
        type: 'optimistic_update',
        gameId,
        data: updateData,
        timestamp: new Date().toISOString()
      };
      callback(event);
    }
  }

  /**
   * Handle server state sync (reconcile optimistic updates)
   */
  handleServerStateSync(gameId: string, serverState: any, callback?: (event: any) => void) {
    if (callback) {
      const event = {
        type: 'server_state_sync',
        gameId,
        serverState,
        timestamp: new Date().toISOString()
      };
      callback(event);
    }
  }

  /**
   * Subscribe to player presence updates
   */
  async subscribeToPlayerPresence(
    gameId: string,
    callbacks: {
      onPlayerOnline?: (playerId: string) => void;
      onPlayerOffline?: (playerId: string) => void;
    }
  ): Promise<() => void> {
    const channel = createGameChannel(gameId);
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        
        // Handle presence changes
        Object.keys(newState).forEach(playerId => {
          if (callbacks.onPlayerOnline) {
            callbacks.onPlayerOnline(playerId);
          }
        });
      })
      .on('presence', { event: 'join' }, ({ key }) => {
        if (callbacks.onPlayerOnline) {
          callbacks.onPlayerOnline(key);
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (callbacks.onPlayerOffline) {
          callbacks.onPlayerOffline(key);
        }
      })
      .subscribe();

    return () => channel.unsubscribe();
  }

  /**
   * Ping server to check connection
   */
  async ping(): Promise<void> {
    // Simple ping implementation - could be a lightweight Supabase operation
    const channel = createGameChannel('ping');
    await channel.subscribe();
    await channel.unsubscribe();
  }
}

// Export singleton instance
export const realtimeService = new RealtimeService();

