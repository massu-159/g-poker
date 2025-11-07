/**
 * Socket.io Client for Real-Time Communication
 * Server-Authoritative Architecture Integration
 *
 * Handles WebSocket connections to Hono backend Socket.io server
 * Implements event contracts from docs/specs/003-g-poker-mobile/contracts/socket-events.md
 */

import { io, Socket } from 'socket.io-client';
import { apiClient } from './ApiClient';

// Socket.io Configuration
const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';
const RECONNECTION_ATTEMPTS = 5;
const RECONNECTION_DELAY = 2000; // 2 seconds
const HEARTBEAT_INTERVAL = 60000; // 60 seconds

/**
 * Socket Event Types (from socket-events.md)
 */

// Authentication Events
export interface AuthenticateEvent {
  access_token: string;
  device_info: {
    device_id: string;
    platform: 'ios' | 'android';
    app_version: string;
  };
}

export interface AuthenticatedEvent {
  user_id: string;
  display_name: string;
  server_time: string;
  connection_id: string;
}

export interface AuthenticationFailedEvent {
  error_code: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'USER_BANNED';
  message: string;
  requires_login: boolean;
}

// Heartbeat Events
export interface HeartbeatEvent {
  timestamp: string;
}

export interface HeartbeatAckEvent {
  server_timestamp: string;
  latency_ms: number;
}

// Room Events
export interface JoinRoomEvent {
  room_id: string;
}

export interface RoomJoinedEvent {
  room_id: string;
  room_state: {
    id: string;
    status: string;
    settings: any;
    created_at: string;
    started_at: string | null;
  };
  participants: Array<{
    id: string;
    display_name: string;
    role: string;
    seat_position: number;
    ready_status: boolean;
    connection_status: string;
    joined_at: string;
  }>;
  your_participation: {
    role: string;
    seat_position: number;
    ready_status: boolean;
  };
}

export interface RoomJoinFailedEvent {
  room_id: string;
  error_code: 'ROOM_NOT_FOUND' | 'ACCESS_DENIED' | 'ROOM_FULL';
  message: string;
}

export interface LeaveRoomEvent {
  room_id: string;
}

export interface RoomLeftEvent {
  room_id: string;
  message: string;
}

export interface ParticipantJoinedEvent {
  room_id: string;
  participant: {
    id: string;
    display_name: string;
    role: string;
    seat_position: number;
    joined_at: string;
  };
}

export interface ParticipantLeftEvent {
  room_id: string;
  participant_id: string;
  reason: 'left_voluntarily' | 'disconnected' | 'kicked' | 'banned';
}

// Game Events
export interface ClaimCardEvent {
  room_id: string;
  claimed_creature: string;
  target_player_id: string;
}

export interface CardClaimedEvent {
  room_id: string;
  claiming_player_id: string;
  claimed_creature: string;
  target_player_id: string;
  round_id: string;
  timestamp: string;
}

export interface RespondToClaimEvent {
  room_id: string;
  round_id: string;
  believe_claim: boolean;
}

export interface ClaimRespondedEvent {
  room_id: string;
  responder_id: string;
  believed_claim: boolean;
  actual_creature: string;
  was_correct: boolean;
  penalty_receiver_id: string;
  timestamp: string;
}

export interface PassCardEvent {
  room_id: string;
  round_id: string;
  target_player_id: string;
  new_claim: string;
}

export interface CardPassedEvent {
  room_id: string;
  from_player_id: string;
  to_player_id: string;
  new_claimed_creature: string;
  pass_count: number;
  timestamp: string;
}

export interface GameStateUpdateEvent {
  room_id: string;
  game_state: {
    status: string;
    current_turn_player_id: string | null;
    round_number: number;
    current_round: any | null;
    players: Array<{
      player_id: string;
      display_name: string;
      seat_position: number;
      hand_count: number;
      penalty_cards: {
        cockroach: number;
        mouse: number;
        bat: number;
        frog: number;
        total: number;
      };
      is_current_turn: boolean;
      connection_status: string;
      has_lost: boolean;
    }>;
    your_hand: {
      cards: Array<{ type: string; id: string }>;
      count: number;
    } | null;
    last_action: any | null;
  };
  timestamp: string;
}

export interface RoundCompletedEvent {
  room_id: string;
  round_number: number;
  loser_id: string;
  penalty_creature: string;
  next_turn_player_id: string;
  timestamp: string;
}

export interface GameEndedEvent {
  room_id: string;
  winner_id: string;
  losers: Array<{
    player_id: string;
    penalty_cards: {
      cockroach: number;
      mouse: number;
      bat: number;
      frog: number;
      total: number;
    };
  }>;
  game_duration_seconds: number;
  timestamp: string;
}

export interface GameActionErrorEvent {
  error_code: string;
  message: string;
  action_attempted: string;
}

// Connection Events
export interface ConnectionStatusEvent {
  room_id: string;
  player_id: string;
  connection_status: 'connected' | 'disconnected' | 'reconnecting';
  timestamp: string;
}

/**
 * Event Handler Types
 */
export type EventHandler<T = any> = (data: T) => void;

export interface SocketEventHandlers {
  // Authentication
  authenticated?: EventHandler<AuthenticatedEvent>;
  authentication_failed?: EventHandler<AuthenticationFailedEvent>;

  // Heartbeat
  heartbeat_ack?: EventHandler<HeartbeatAckEvent>;

  // Room
  room_joined?: EventHandler<RoomJoinedEvent>;
  room_join_failed?: EventHandler<RoomJoinFailedEvent>;
  room_left?: EventHandler<RoomLeftEvent>;
  participant_joined?: EventHandler<ParticipantJoinedEvent>;
  participant_left?: EventHandler<ParticipantLeftEvent>;

  // Game
  card_claimed?: EventHandler<CardClaimedEvent>;
  claim_responded?: EventHandler<ClaimRespondedEvent>;
  card_passed?: EventHandler<CardPassedEvent>;
  game_state_update?: EventHandler<GameStateUpdateEvent>;
  round_completed?: EventHandler<RoundCompletedEvent>;
  game_ended?: EventHandler<GameEndedEvent>;
  game_action_error?: EventHandler<GameActionErrorEvent>;

  // Connection
  connection_status?: EventHandler<ConnectionStatusEvent>;

  // Socket.io lifecycle
  connect?: EventHandler<void>;
  disconnect?: EventHandler<string>;
  connect_error?: EventHandler<Error>;
}

/**
 * Socket.io Client Manager
 */
export class SocketIoClient {
  private socket: Socket | null = null;
  private isAuthenticated = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private reconnectAttempts = 0;

  constructor() {
    console.log('[SocketClient] Initialized');
  }

  /**
   * Connect to Socket.io server
   */
  async connect(): Promise<boolean> {
    if (this.socket?.connected) {
      console.log('[SocketClient] Already connected');
      return true;
    }

    try {
      console.log('[SocketClient] Connecting to:', SOCKET_URL);

      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: RECONNECTION_ATTEMPTS,
        reconnectionDelay: RECONNECTION_DELAY,
        timeout: 20000,
      });

      // Setup lifecycle event handlers
      this.socket.on('connect', () => {
        console.log('[SocketClient] Connected:', this.socket?.id);
        this.reconnectAttempts = 0;
        this.emitToHandlers('connect', undefined);
        this.authenticate();
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[SocketClient] Disconnected:', reason);
        this.isAuthenticated = false;
        this.stopHeartbeat();
        this.emitToHandlers('disconnect', reason);
      });

      this.socket.on('connect_error', (error) => {
        console.error('[SocketClient] Connection error:', error);
        this.reconnectAttempts++;
        this.emitToHandlers('connect_error', error);
      });

      // Setup event listeners
      this.setupEventListeners();

      return true;
    } catch (error) {
      console.error('[SocketClient] Failed to connect:', error);
      return false;
    }
  }

  /**
   * Authenticate with Socket.io server using JWT
   */
  private async authenticate() {
    const accessToken = apiClient.getAccessToken();
    if (!accessToken) {
      console.warn('[SocketClient] No access token available for authentication');
      return;
    }

    const deviceId = await this.getDeviceId();
    const platform = this.getPlatform();
    const appVersion = this.getAppVersion();

    const authenticatePayload: AuthenticateEvent = {
      access_token: accessToken,
      device_info: {
        device_id: deviceId,
        platform,
        app_version: appVersion,
      },
    };

    console.log('[SocketClient] Authenticating...');
    this.socket?.emit('authenticate', authenticatePayload);
  }

  /**
   * Setup Socket.io event listeners
   */
  private setupEventListeners() {
    if (!this.socket) return;

    // Authentication events
    this.socket.on('authenticated', (data: AuthenticatedEvent) => {
      console.log('[SocketClient] Authenticated:', data.user_id);
      this.isAuthenticated = true;
      this.startHeartbeat();
      this.emitToHandlers('authenticated', data);
    });

    this.socket.on('authentication_failed', (data: AuthenticationFailedEvent) => {
      console.error('[SocketClient] Authentication failed:', data);
      this.isAuthenticated = false;
      this.emitToHandlers('authentication_failed', data);
    });

    // Heartbeat events
    this.socket.on('heartbeat_ack', (data: HeartbeatAckEvent) => {
      console.log('[SocketClient] Heartbeat ACK - Latency:', data.latency_ms, 'ms');
      this.emitToHandlers('heartbeat_ack', data);
    });

    // Room events
    this.socket.on('room_joined', (data: RoomJoinedEvent) => {
      console.log('[SocketClient] Room joined:', data.room_id);
      this.emitToHandlers('room_joined', data);
    });

    this.socket.on('room_join_failed', (data: RoomJoinFailedEvent) => {
      console.error('[SocketClient] Room join failed:', data);
      this.emitToHandlers('room_join_failed', data);
    });

    this.socket.on('room_left', (data: RoomLeftEvent) => {
      console.log('[SocketClient] Room left:', data.room_id);
      this.emitToHandlers('room_left', data);
    });

    this.socket.on('participant_joined', (data: ParticipantJoinedEvent) => {
      console.log('[SocketClient] Participant joined:', data.participant.display_name);
      this.emitToHandlers('participant_joined', data);
    });

    this.socket.on('participant_left', (data: ParticipantLeftEvent) => {
      console.log('[SocketClient] Participant left:', data.participant_id);
      this.emitToHandlers('participant_left', data);
    });

    // Game events
    this.socket.on('card_claimed', (data: CardClaimedEvent) => {
      console.log('[SocketClient] Card claimed:', data.claimed_creature);
      this.emitToHandlers('card_claimed', data);
    });

    this.socket.on('claim_responded', (data: ClaimRespondedEvent) => {
      console.log('[SocketClient] Claim responded:', data.was_correct);
      this.emitToHandlers('claim_responded', data);
    });

    this.socket.on('card_passed', (data: CardPassedEvent) => {
      console.log('[SocketClient] Card passed:', data.to_player_id);
      this.emitToHandlers('card_passed', data);
    });

    this.socket.on('game_state_update', (data: GameStateUpdateEvent) => {
      console.log('[SocketClient] Game state updated');
      this.emitToHandlers('game_state_update', data);
    });

    this.socket.on('round_completed', (data: RoundCompletedEvent) => {
      console.log('[SocketClient] Round completed:', data.round_number);
      this.emitToHandlers('round_completed', data);
    });

    this.socket.on('game_ended', (data: GameEndedEvent) => {
      console.log('[SocketClient] Game ended - Winner:', data.winner_id);
      this.emitToHandlers('game_ended', data);
    });

    this.socket.on('game_action_error', (data: GameActionErrorEvent) => {
      console.error('[SocketClient] Game action error:', data);
      this.emitToHandlers('game_action_error', data);
    });

    // Connection status events
    this.socket.on('connection_status', (data: ConnectionStatusEvent) => {
      console.log('[SocketClient] Connection status:', data);
      this.emitToHandlers('connection_status', data);
    });
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected && this.isAuthenticated) {
        this.sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send heartbeat to server
   */
  private sendHeartbeat() {
    const heartbeatPayload: HeartbeatEvent = {
      timestamp: new Date().toISOString(),
    };

    this.socket?.emit('heartbeat', heartbeatPayload);
  }

  /**
   * Emit event to registered handlers
   */
  private emitToHandlers(event: string, data: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[SocketClient] Handler error for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Register event handler
   */
  on<K extends keyof SocketEventHandlers>(
    event: K,
    handler: SocketEventHandlers[K]
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(event)?.delete(handler as EventHandler);
    };
  }

  /**
   * Remove event handler
   */
  off<K extends keyof SocketEventHandlers>(
    event: K,
    handler: SocketEventHandlers[K]
  ) {
    this.eventHandlers.get(event)?.delete(handler as EventHandler);
  }

  /**
   * Join room via Socket.io
   */
  joinRoom(roomId: string) {
    if (!this.isAuthenticated) {
      console.error('[SocketClient] Cannot join room - not authenticated');
      return;
    }

    const payload: JoinRoomEvent = { room_id: roomId };
    console.log('[SocketClient] Joining room:', roomId);
    this.socket?.emit('join_room', payload);
  }

  /**
   * Leave room via Socket.io
   */
  leaveRoom(roomId: string) {
    const payload: LeaveRoomEvent = { room_id: roomId };
    console.log('[SocketClient] Leaving room:', roomId);
    this.socket?.emit('leave_room', payload);
  }

  /**
   * Update ready status in room
   */
  updateReadyStatus(roomId: string, isReady: boolean) {
    const payload = { room_id: roomId, is_ready: isReady };
    console.log('[SocketClient] Updating ready status:', roomId, isReady);
    this.socket?.emit('update_ready_status', payload);
  }

  /**
   * Send claim card action
   */
  claimCard(roomId: string, claimedCreature: string, targetPlayerId: string) {
    const payload: ClaimCardEvent = {
      room_id: roomId,
      claimed_creature: claimedCreature,
      target_player_id: targetPlayerId,
    };

    console.log('[SocketClient] Claiming card:', claimedCreature);
    this.socket?.emit('claim_card', payload);
  }

  /**
   * Send respond to claim action
   */
  respondToClaim(roomId: string, roundId: string, believeClaim: boolean) {
    const payload: RespondToClaimEvent = {
      room_id: roomId,
      round_id: roundId,
      believe_claim: believeClaim,
    };

    console.log('[SocketClient] Responding to claim:', believeClaim);
    this.socket?.emit('respond_to_claim', payload);
  }

  /**
   * Send pass card action
   */
  passCard(roomId: string, roundId: string, targetPlayerId: string, newClaim: string) {
    const payload: PassCardEvent = {
      room_id: roomId,
      round_id: roundId,
      target_player_id: targetPlayerId,
      new_claim: newClaim,
    };

    console.log('[SocketClient] Passing card to:', targetPlayerId);
    this.socket?.emit('pass_card', payload);
  }

  /**
   * Disconnect from Socket.io server
   */
  disconnect() {
    console.log('[SocketClient] Disconnecting...');
    this.stopHeartbeat();
    this.socket?.disconnect();
    this.socket = null;
    this.isAuthenticated = false;
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get authentication status
   */
  isAuth(): boolean {
    return this.isAuthenticated;
  }

  // Utility methods
  private async getDeviceId(): Promise<string> {
    // TODO: Implement proper device ID retrieval (use expo-device)
    return 'device-' + Math.random().toString(36).substring(7);
  }

  private getPlatform(): 'ios' | 'android' {
    // TODO: Implement proper platform detection (use expo-constants)
    return 'ios';
  }

  private getAppVersion(): string {
    // TODO: Implement proper app version retrieval (use expo-constants)
    return '1.0.0';
  }
}

// Export singleton instance
export const socketClient = new SocketIoClient();

// Export for testing
export default socketClient;
