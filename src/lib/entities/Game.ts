/**
 * Game Entity Model
 * Represents a ごきぶりポーカー game instance with TypeScript interfaces
 */

export type GameStatus = 
  | 'waiting_for_players'
  | 'in_progress' 
  | 'paused'
  | 'ended'
  | 'abandoned';

export interface GameSettings {
  winCondition: number; // Number of cards of same type to lose (typically 3)
  turnTimeLimit: number; // Time limit per turn in seconds
  maxReconnectTime?: number; // Max time to wait for reconnection
  allowSpectators?: boolean;
}

export interface GameMetadata {
  id: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  createdBy: string; // Player ID who created the game
  version: number; // For optimistic concurrency control
}

export interface GameState {
  currentTurn: string; // Player ID whose turn it is
  turnStartedAt?: string;
  turnTimeRemaining?: number;
  lastAction?: {
    type: string;
    playerId: string;
    timestamp: string;
    data: any;
  };
}

import type { Round } from './Round';
export type GameRound = Round;

export interface Game extends GameMetadata {
  status: GameStatus;
  settings: GameSettings;
  state: GameState;
  playerIds: string[]; // Array of player IDs in turn order
  currentRound?: GameRound;
  winnerId?: string; // Set when game ends
  
  // Computed properties
  playersCount: number;
  isActive: boolean; // true if status is 'in_progress'
  canJoin: boolean; // true if waiting_for_players and not full
}

// Database row interface (matches actual Supabase schema)
export interface GameRow {
  id: string;
  status: string; // GameStatus stored as string
  settings: any; // JSON stored settings
  current_turn: string | null;
  winner_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

// Create game request interface
export interface CreateGameRequest {
  settings: GameSettings;
  createdBy: string;
  displayName?: string;
}

// Game update request interface
export interface UpdateGameRequest {
  gameId: string;
  updates: Partial<{
    status: string;
    current_turn: string | null;
    winner_id: string | null;
    started_at: string | null;
    ended_at: string | null;
  }>;
  expectedVersion?: number; // Optional for optimistic concurrency control
}

// Game query interface
export interface GameQuery {
  status?: GameStatus;
  playerId?: string;
  createdAfter?: string;
  limit?: number;
  offset?: number;
}

// Validation functions
export const validateGameSettings = (settings: GameSettings): boolean => {
  return (
    settings.winCondition >= 2 && 
    settings.winCondition <= 6 &&
    settings.turnTimeLimit >= 10 && 
    settings.turnTimeLimit <= 300
  );
};

export const validateGameStatus = (status: GameStatus): boolean => {
  const validStatuses: GameStatus[] = [
    'waiting_for_players',
    'in_progress',
    'paused', 
    'ended',
    'abandoned'
  ];
  return validStatuses.includes(status);
};

// Game state helpers
export const canStartGame = (game: Game): boolean => {
  return (
    game.status === 'waiting_for_players' &&
    game.playersCount === 2
  );
};

export const isGameActive = (game: Game): boolean => {
  return game.status === 'in_progress';
};

export const isGameFinished = (game: Game): boolean => {
  return game.status === 'ended' || game.status === 'abandoned';
};

export const canJoinGame = (game: Game): boolean => {
  return (
    game.status === 'waiting_for_players' &&
    game.playersCount < 2
  );
};

// Game transformation helpers
export const gameRowToGame = (row: GameRow): Game => ({
  id: row.id,
  status: row.status as GameStatus,
  settings: row.settings,
  state: {
    currentTurn: row.current_turn || ''
    // turnStartedAt and lastAction are omitted (undefined) for default state
  }, // Create default state
  playerIds: [], // Will be populated by fetching players separately
  ...(row.winner_id !== null && { winnerId: row.winner_id }),
  createdAt: row.created_at,
  ...(row.started_at !== null && { startedAt: row.started_at }),
  ...(row.ended_at !== null && { endedAt: row.ended_at }),
  createdBy: '', // Not stored in current schema
  version: 1, // Default version
  
  // Computed properties
  playersCount: 0, // Will be computed from players query
  isActive: row.status === 'in_progress',
  canJoin: row.status === 'waiting_for_players'
});

export const gameToGameRow = (game: Game): Omit<GameRow, 'created_at'> => ({
  id: game.id,
  status: game.status,
  settings: game.settings,
  current_turn: game.state.currentTurn || null,
  winner_id: game.winnerId || null,
  started_at: game.startedAt || null,
  ended_at: game.endedAt || null
});

// Default values
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  winCondition: 3,
  turnTimeLimit: 60,
  maxReconnectTime: 300, // 5 minutes
  allowSpectators: false
};

export const createDefaultGameState = (firstPlayerId: string): GameState => ({
  currentTurn: firstPlayerId,
  turnStartedAt: new Date().toISOString()
});