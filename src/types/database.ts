/**
 * G-Poker Database Types
 * TypeScript definitions for Cockroach Poker Supabase database schema
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          created_at: string;
          updated_at: string;
          last_seen_at: string;
          is_active: boolean;
        };
        Insert: {
          id: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
          is_active?: boolean;
        };
      };
      profiles: {
        Row: {
          id: string;
          display_name: string;
          avatar_url: string | null;
          verification_status: string;
          games_played: number;
          games_won: number;
          win_rate: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          avatar_url?: string | null;
          verification_status?: string;
          games_played?: number;
          games_won?: number;
          win_rate?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          avatar_url?: string | null;
          verification_status?: string;
          games_played?: number;
          games_won?: number;
          win_rate?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          creator_id: string;
          status: string;
          max_players: number;
          current_player_count: number;
          current_turn_player_id: string | null;
          round_number: number;
          time_limit_seconds: number;
          hidden_card_count: number;
          game_deck: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          status?: string;
          max_players?: number;
          current_player_count?: number;
          current_turn_player_id?: string | null;
          round_number?: number;
          time_limit_seconds?: number;
          hidden_card_count?: number;
          game_deck?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          status?: string;
          max_players?: number;
          current_player_count?: number;
          current_turn_player_id?: string | null;
          round_number?: number;
          time_limit_seconds?: number;
          hidden_card_count?: number;
          game_deck?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      game_participants: {
        Row: {
          id: string;
          game_id: string;
          player_id: string;
          status: string;
          position: number;
          hand_cards: Record<string, any>;
          penalty_cockroach: Record<string, any>;
          penalty_mouse: Record<string, any>;
          penalty_bat: Record<string, any>;
          penalty_frog: Record<string, any>;
          cards_remaining: number;
          has_lost: boolean;
          losing_creature_type: string | null;
          joined_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          player_id: string;
          status?: string;
          position: number;
          hand_cards?: Record<string, any>;
          penalty_cockroach?: Record<string, any>;
          penalty_mouse?: Record<string, any>;
          penalty_bat?: Record<string, any>;
          penalty_frog?: Record<string, any>;
          cards_remaining?: number;
          has_lost?: boolean;
          losing_creature_type?: string | null;
          joined_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          player_id?: string;
          status?: string;
          position?: number;
          hand_cards?: Record<string, any>;
          penalty_cockroach?: Record<string, any>;
          penalty_mouse?: Record<string, any>;
          penalty_bat?: Record<string, any>;
          penalty_frog?: Record<string, any>;
          cards_remaining?: number;
          has_lost?: boolean;
          losing_creature_type?: string | null;
          joined_at?: string;
          updated_at?: string;
        };
      };
      game_rounds: {
        Row: {
          id: string;
          game_id: string;
          round_number: number;
          current_card: Record<string, any>;
          claiming_player_id: string;
          claimed_creature_type: string;
          target_player_id: string;
          pass_count: number;
          is_completed: boolean;
          final_guesser_id: string | null;
          guess_is_truth: boolean | null;
          actual_is_truth: boolean | null;
          penalty_receiver_id: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          round_number: number;
          current_card: Record<string, any>;
          claiming_player_id: string;
          claimed_creature_type: string;
          target_player_id: string;
          pass_count?: number;
          is_completed?: boolean;
          final_guesser_id?: string | null;
          guess_is_truth?: boolean | null;
          actual_is_truth?: boolean | null;
          penalty_receiver_id?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          game_id?: string;
          round_number?: number;
          current_card?: Record<string, any>;
          claiming_player_id?: string;
          claimed_creature_type?: string;
          target_player_id?: string;
          pass_count?: number;
          is_completed?: boolean;
          final_guesser_id?: string | null;
          guess_is_truth?: boolean | null;
          actual_is_truth?: boolean | null;
          penalty_receiver_id?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
      };
      game_actions: {
        Row: {
          id: string;
          game_id: string;
          round_id: string | null;
          player_id: string;
          action_type: string;
          action_data: Record<string, any>;
          created_at: string;
          action_timestamp: string;
          is_valid: boolean;
          validation_errors: Record<string, any> | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          round_id?: string | null;
          player_id: string;
          action_type: string;
          action_data: Record<string, any>;
          created_at?: string;
          action_timestamp?: string;
          is_valid?: boolean;
          validation_errors?: Record<string, any> | null;
        };
        Update: {
          id?: string;
          game_id?: string;
          round_id?: string | null;
          player_id?: string;
          action_type?: string;
          action_data?: Record<string, any>;
          created_at?: string;
          action_timestamp?: string;
          is_valid?: boolean;
          validation_errors?: Record<string, any> | null;
        };
      };
    };
    Views: {
      leaderboard: {
        Row: {
          id: string;
          display_name: string | null;
          games_played: number;
          games_won: number;
          win_rate: number;
          updated_at: string;
          rank: number;
        };
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      creature_type: 'cockroach' | 'mouse' | 'bat' | 'frog';
      game_status: 'waiting' | 'in_progress' | 'completed' | 'cancelled';
      player_status: 'joined' | 'playing' | 'disconnected' | 'left';
      verification_status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'suspended';
    };
  };
}

// Type aliases for convenience
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Game = Database['public']['Tables']['games']['Row'];
export type GameInsert = Database['public']['Tables']['games']['Insert'];
export type GameUpdate = Database['public']['Tables']['games']['Update'];

export type GameParticipant = Database['public']['Tables']['game_participants']['Row'];
export type GameParticipantInsert = Database['public']['Tables']['game_participants']['Insert'];
export type GameParticipantUpdate = Database['public']['Tables']['game_participants']['Update'];

export type GameRound = Database['public']['Tables']['game_rounds']['Row'];
export type GameRoundInsert = Database['public']['Tables']['game_rounds']['Insert'];
export type GameRoundUpdate = Database['public']['Tables']['game_rounds']['Update'];

export type GameAction = Database['public']['Tables']['game_actions']['Row'];
export type GameActionInsert = Database['public']['Tables']['game_actions']['Insert'];
export type GameActionUpdate = Database['public']['Tables']['game_actions']['Update'];

export type Leaderboard = Database['public']['Views']['leaderboard']['Row'];

// Enum type aliases
export type CreatureType = Database['public']['Enums']['creature_type'];
export type GameStatus = Database['public']['Enums']['game_status'];
export type PlayerStatus = Database['public']['Enums']['player_status'];
export type VerificationStatus = Database['public']['Enums']['verification_status'];

// Cockroach Poker game settings interface
export interface CockroachPokerSettings {
  timeLimit?: number; // seconds per action (default: 30)
  allowSpectators?: boolean;
}

// Extended game interface with participants
export interface GameWithParticipants extends Game {
  participants: (GameParticipant & {
    player: Profile;
  })[];
}

// Player information for lobby display
export interface LobbyPlayer {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  verificationStatus: VerificationStatus;
  gamesPlayed: number;
  winRate: number;
  isReady: boolean;
  position: number;
  connectionStatus: 'connected' | 'disconnected';
}

// Penalty pile interface for Cockroach Poker
export interface PenaltyPile {
  cockroach: any[];
  mouse: any[];
  bat: any[];
  frog: any[];
}

export default Database;