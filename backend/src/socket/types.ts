/**
 * Socket.io Event Types
 * Based on docs/specs/003-g-poker-mobile/contracts/socket-events.md
 */

import { Socket } from 'socket.io'

// Extended Socket with authentication data
export interface AuthenticatedSocket extends Socket {
  userId?: string
  displayName?: string
  deviceId?: string
  connectionId?: string
}

// Connection Management Events

export interface AuthenticateEvent {
  access_token: string
  device_info: {
    device_id: string
    platform: 'ios' | 'android'
    app_version: string
  }
}

export interface AuthenticatedEvent {
  user_id: string
  display_name: string
  server_time: string
  connection_id: string
}

export interface AuthenticationFailedEvent {
  error_code: 'INVALID_TOKEN' | 'TOKEN_EXPIRED' | 'USER_BANNED'
  message: string
  requires_login: boolean
}

export interface ConnectionErrorEvent {
  error_code: 'RATE_LIMITED' | 'SERVER_ERROR' | 'INVALID_ROOM'
  message: string
  retry_after_seconds?: number
}

export interface HeartbeatEvent {
  timestamp: string
}

export interface HeartbeatAckEvent {
  server_timestamp: string
  latency_ms: number
}

// Room State Events

export interface JoinRoomEvent {
  room_id: string
}

export interface LeaveRoomEvent {
  room_id: string
}

export interface RoomSettings {
  max_players: number
  time_limit_seconds: number
  allow_spectators: boolean
}

export interface Participant {
  id: string
  display_name: string
  role: 'player' | 'spectator'
  seat_position: number | null
  ready_status: boolean
  connection_status: 'connected' | 'disconnected' | 'reconnecting'
  joined_at: string
}

export interface RoomState {
  id: string
  status: 'waiting' | 'in_progress' | 'completed' | 'cancelled'
  settings: RoomSettings
  created_at: string
  started_at: string | null
}

export interface YourParticipation {
  role: 'player' | 'spectator'
  seat_position: number | null
  ready_status: boolean
}

export interface RoomJoinedEvent {
  room_id: string
  room_state: RoomState
  participants: Participant[]
  your_participation: YourParticipation
}

export interface RoomJoinFailedEvent {
  room_id: string
  error_code: 'ROOM_NOT_FOUND' | 'ACCESS_DENIED' | 'ROOM_FULL'
  message: string
}

export interface RoomLeftEvent {
  room_id: string
  message: string
}

export interface ParticipantJoinedEvent {
  room_id: string
  participant: {
    id: string
    display_name: string
    role: 'player' | 'spectator'
    seat_position: number | null
    joined_at: string
  }
}

export interface ParticipantLeftEvent {
  room_id: string
  participant_id: string
  reason: 'left_voluntarily' | 'disconnected' | 'kicked'
}

export interface ParticipantStatusUpdateEvent {
  room_id: string
  participant_id: string
  connection_status: 'connected' | 'disconnected' | 'reconnecting'
  ready_status?: boolean
}

// Game State Events

export interface GameCreature {
  type: 'cockroach' | 'mouse' | 'bat' | 'frog'
  id: string
}

export interface PlayerHand {
  cards: GameCreature[]
  count: number
}

export interface PenaltyCards {
  cockroach: number
  mouse: number
  bat: number
  frog: number
  total: number
}

export interface PlayerGameState {
  player_id: string
  display_name: string
  seat_position: number
  hand_count: number
  penalty_cards: PenaltyCards
  is_current_turn: boolean
  connection_status: 'connected' | 'disconnected' | 'reconnecting'
  has_lost: boolean
}

export interface CurrentRound {
  id: string
  claiming_player_id: string
  claimed_creature: string
  target_player_id: string
  pass_count: number
  can_respond: boolean
  can_pass: boolean
}

export interface GameStateUpdateEvent {
  room_id: string
  game_state: {
    status: 'waiting' | 'in_progress' | 'completed' | 'cancelled'
    current_turn_player_id: string | null
    round_number: number
    current_round: CurrentRound | null
    players: PlayerGameState[]
    your_hand: PlayerHand | null
    last_action: {
      type: string
      player_id: string
      timestamp: string
    } | null
  }
  timestamp: string
}

// Game Action Events

export interface ClaimCardEvent {
  room_id: string
  card_id: string
  claimed_creature: string
  target_player_id: string
}

export interface RespondToClaimEvent {
  room_id: string
  round_id: string
  believe_claim: boolean
}

export interface PassCardEvent {
  room_id: string
  round_id: string
  target_player_id: string
  new_claim: string
}

export interface CardClaimedEvent {
  room_id: string
  claiming_player_id: string
  claimed_creature: string
  target_player_id: string
  round_id: string
  timestamp: string
}

export interface ClaimRespondedEvent {
  room_id: string
  responder_id: string
  believed_claim: boolean
  actual_creature: string
  was_correct: boolean
  penalty_receiver_id: string
  timestamp: string
}

export interface CardPassedEvent {
  room_id: string
  from_player_id: string
  to_player_id: string
  new_claimed_creature: string
  pass_count: number
  timestamp: string
}

export interface TurnTimeoutEvent {
  room_id: string
  timed_out_player_id: string
  auto_action_taken: {
    type: 'auto_believe' | 'auto_pass' | 'forfeit'
    description: string
  }
  timestamp: string
}

export interface RoundCompletedEvent {
  room_id: string
  round_number: number
  loser_id: string
  penalty_creature: string
  next_turn_player_id: string | null
  timestamp: string
}

export interface GameEndedEvent {
  room_id: string
  winner_id: string
  losers: Array<{
    player_id: string
    penalty_cards: PenaltyCards
  }>
  game_duration_seconds: number
  timestamp: string
}

// Error Events

export interface GameActionErrorEvent {
  error_code:
    | 'NOT_YOUR_TURN'
    | 'INVALID_ACTION'
    | 'GAME_NOT_ACTIVE'
    | 'PLAYER_NOT_IN_GAME'
    | 'INVALID_TARGET'
  message: string
  action_attempted: string
}
