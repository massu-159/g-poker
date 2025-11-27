/**
 * Database Schema Type Definitions
 * Auto-generated from Supabase schema
 * Last updated: 2025-11-02
 */

// ============================================================================
// Enum Types
// ============================================================================

export type GameStatus = 'waiting' | 'in_progress' | 'completed' | 'cancelled'

export type CreatureType = 'cockroach' | 'mouse' | 'bat' | 'frog'

export type PlayerStatus = 'joined' | 'playing' | 'disconnected' | 'left'

export type ActionType =
  | 'join_game'
  | 'leave_game'
  | 'start_game'
  | 'pass_card'
  | 'make_claim'
  | 'guess_truth'
  | 'guess_lie'
  | 'pass_back'
  | 'receive_penalty'
  | 'game_end'

export type ThemePreference = 'light' | 'dark' | 'auto'

export type MobileCardSize = 'small' | 'medium' | 'large'

// ============================================================================
// Table Types
// ============================================================================

/**
 * Simplified user profiles for MVP
 */
export interface Profile {
  id: string // uuid
  email: string | null
  created_at: string | null // timestamptz
  updated_at: string | null // timestamptz
  last_seen_at: string | null // timestamptz
  is_active: boolean | null
}

/**
 * Simplified public profiles for MVP
 */
export interface PublicProfile {
  id: string // uuid
  profile_id: string | null // uuid
  display_name: string | null
  username: string | null // unique
  avatar_url: string | null
  created_at: string | null // timestamptz
  updated_at: string | null // timestamptz
}

/**
 * Simplified games table for MVP - 2 players, 6 hidden cards
 */
export interface Game {
  id: string // uuid
  created_at: string | null // timestamptz
  updated_at: string | null // timestamptz
  creator_id: string | null // uuid -> public_profiles.id
  current_turn_player_id: string | null // uuid -> public_profiles.id
  round_number: number | null // default: 0
  time_limit_seconds: number | null // default: 30
  game_deck: GameCard[] | null // jsonb
  status: GameStatus | null // default: 'waiting'
}

/**
 * Game participant (2 players per game)
 */
export interface GameParticipant {
  id: string // uuid
  game_id: string | null // uuid -> games.id
  player_id: string | null // uuid -> public_profiles.id
  joined_at: string | null // timestamptz
  position: number | null // CHECK: position IN (1, 2)
  hand_cards: GameCard[] | null // jsonb, default: []
  penalty_cockroach: GameCard[] | null // jsonb, default: []
  penalty_mouse: GameCard[] | null // jsonb, default: []
  penalty_bat: GameCard[] | null // jsonb, default: []
  penalty_frog: GameCard[] | null // jsonb, default: []
  cards_remaining: number | null // default: 9
  has_lost: boolean | null // default: false
  losing_creature_type: CreatureType | null
  updated_at: string | null // timestamptz
  status: PlayerStatus | null // default: 'joined'
}

/**
 * Game round (each claim/pass/guess cycle)
 */
export interface GameRound {
  id: string // uuid
  game_id: string | null // uuid -> games.id
  round_number: number // not null
  completed_at: string | null // timestamptz
  created_at: string | null // timestamptz
  updated_at: string | null // timestamptz
  current_card: GameCard // jsonb, not null
  claiming_player_id: string // uuid -> game_participants.id, not null
  claimed_creature_type: CreatureType // not null
  target_player_id: string // uuid -> game_participants.id, not null
  pass_count: number | null // default: 0
  is_completed: boolean | null // default: false
  final_guesser_id: string | null // uuid -> game_participants.id
  guess_is_truth: boolean | null
  actual_is_truth: boolean | null
  penalty_receiver_id: string | null // uuid -> game_participants.id
}

/**
 * Game action history (audit trail)
 */
export interface GameAction {
  id: string // uuid
  game_id: string | null // uuid -> games.id
  round_id: string | null // uuid -> game_rounds.id
  player_id: string | null // uuid -> public_profiles.id
  action_type: ActionType // not null
  action_data: Record<string, unknown> // jsonb, not null
  created_at: string | null // timestamptz
}

/**
 * Simplified sessions table for MVP
 */
export interface UserSession {
  id: string // uuid
  user_id: string // uuid -> auth.users.id, not null
  session_token: string // unique, not null
  refresh_token: string // unique, not null
  user_agent: string | null
  ip_address: string | null // inet
  device_type: string | null
  is_active: boolean // default: true, not null
  last_activity_at: string // timestamptz, default: now(), not null
  created_at: string // timestamptz, default: now(), not null
  expires_at: string // timestamptz, default: now() + 7 days, not null
  terminated_at: string | null // timestamptz
}

/**
 * Simplified preferences for MVP - basic theme, sound, and mobile settings only
 */
export interface UserPreferences {
  id: string // uuid
  user_id: string // uuid -> auth.users.id, unique, not null
  theme: ThemePreference // default: 'dark', not null
  language: string // default: 'en', not null
  sound_enabled: boolean // default: true, not null
  sound_volume: number | null // numeric, default: 0.8, CHECK: 0.0-1.0
  action_timeout_seconds: number | null // default: 30, CHECK: 15-120
  mobile_card_size: MobileCardSize | null // default: 'medium'
  mobile_vibration_enabled: boolean // default: true, not null
  created_at: string // timestamptz, default: now(), not null
  updated_at: string // timestamptz, default: now(), not null
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Game card representation
 */
export interface GameCard {
  id: string
  type: CreatureType
}

/**
 * Penalty cards summary
 */
export interface PenaltyCards {
  cockroach: number
  mouse: number
  bat: number
  frog: number
  total: number
}

// ============================================================================
// Database Response Types (with relations)
// ============================================================================

/**
 * Profile with public_profiles relation
 */
export interface ProfileWithPublic extends Profile {
  public_profiles?: PublicProfile[]
}

/**
 * Profile with public_profiles and preferences
 */
export interface ProfileComplete extends Profile {
  public_profiles?: PublicProfile[]
  user_preferences?: UserPreferences[]
}

/**
 * Game participant with profile info
 */
export interface GameParticipantWithProfile extends GameParticipant {
  profiles?: {
    public_profiles?: Pick<PublicProfile, 'display_name' | 'avatar_url'>[]
  }
}

/**
 * Game with participants
 */
export interface GameWithParticipants extends Game {
  game_participants?: GameParticipantWithProfile[]
}
