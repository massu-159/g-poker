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

// Database row interface (matches Supabase schema)
export interface GameRow {
  id: string;
  status: GameStatus;
  settings: GameSettings;
  state: GameState;
  player_ids: string[];
  current_round: any | null; // JSON stored round data
  winner_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  created_by: string;
  version: number;
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
    status: GameStatus;
    state: GameState;
    currentRound: GameRound;
    winnerId: string;
  }>;
  expectedVersion: number; // For optimistic concurrency control
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
  status: row.status,
  settings: row.settings,
  state: row.state,
  playerIds: row.player_ids,
  ...(row.current_round !== null && { currentRound: row.current_round }),
  ...(row.winner_id !== null && { winnerId: row.winner_id }),
  createdAt: row.created_at,
  ...(row.started_at !== null && { startedAt: row.started_at }),
  ...(row.ended_at !== null && { endedAt: row.ended_at }),
  createdBy: row.created_by,
  version: row.version,
  
  // Computed properties
  playersCount: row.player_ids.length,
  isActive: row.status === 'in_progress',
  canJoin: row.status === 'waiting_for_players' && row.player_ids.length < 2
});

export const gameToGameRow = (game: Game): Omit<GameRow, 'created_at' | 'version'> => ({
  id: game.id,
  status: game.status,
  settings: game.settings,
  state: game.state,
  player_ids: game.playerIds,
  current_round: game.currentRound || null,
  winner_id: game.winnerId || null,
  started_at: game.startedAt || null,
  ended_at: game.endedAt || null,
  created_by: game.createdBy
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