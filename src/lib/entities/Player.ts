/**
 * Player Entity Model
 * Represents a player in a ごきぶりポーカー game with validation
 */

import { Card } from './Card';

export interface PlayerAuth {
  deviceId: string;
  sessionToken?: string;
  userId?: string; // Optional user account ID
}

export interface PlayerProfile {
  displayName: string;
  avatar?: string;
  level?: number;
  gamesPlayed?: number;
  gamesWon?: number;
  preferences?: {
    sound: boolean;
    animations: boolean;
    autoPassBack?: boolean;
  };
}

export interface PlayerConnection {
  isConnected: boolean;
  lastSeen: string;
  connectionId?: string; // Realtime connection ID
  reconnectAttempts?: number;
  gracePeriodEndsAt?: string; // When disconnection timeout expires
}

export interface PlayerGameState {
  hand: Card[];
  penaltyPile: {
    cockroach: Card[];
    mouse: Card[];
    bat: Card[];
    frog: Card[];
  };
  turnPosition: number; // 0 or 1 for 2-player game
  isReady: boolean;
  score?: number; // Total penalty cards across all piles
  hasLost?: boolean; // True if reached win condition
}

export interface PlayerStatistics {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  averageGameDuration: number; // in seconds
  fastestWin: number; // in seconds
  longestGame: number; // in seconds
  creaturePreferences: {
    cockroach: { played: number; won: number };
    mouse: { played: number; won: number };
    bat: { played: number; won: number };
    frog: { played: number; won: number };
  };
}

export interface Player {
  id: string;
  deviceId: string;
  profile: PlayerProfile;
  connection: PlayerConnection;
  gameState?: PlayerGameState; // Only present when in a game
  statistics: PlayerStatistics;
  createdAt: string;
  updatedAt: string;
}

// Database row interface (matches Supabase schema)
export interface PlayerRow {
  id: string;
  device_id: string;
  display_name: string;
  avatar: string | null;
  is_connected: boolean;
  last_seen: string;
  connection_id: string | null;
  preferences: any; // JSON
  statistics: any; // JSON
  created_at: string;
  updated_at: string;
}

// Player in game context (includes game-specific state)
export interface GamePlayer extends Player {
  gameId: string;
  gameState: PlayerGameState;
  joinedAt: string;
}

// Game player row interface
export interface GamePlayerRow {
  id: string;
  game_id: string;
  player_id: string;
  hand: any; // JSON array of cards
  penalty_pile: any; // JSON object with creature arrays
  turn_position: number;
  is_ready: boolean;
  joined_at: string;
  left_at: string | null;
}

// Create player request
export interface CreatePlayerRequest {
  deviceId: string;
  displayName: string;
  avatar?: string;
  preferences?: PlayerProfile['preferences'];
}

// Update player request
export interface UpdatePlayerRequest {
  playerId: string;
  updates: Partial<{
    profile: Partial<PlayerProfile>;
    connection: Partial<PlayerConnection>;
    gameState: Partial<PlayerGameState>;
  }>;
}

// Player query interface
export interface PlayerQuery {
  deviceId?: string;
  gameId?: string;
  isConnected?: boolean;
  limit?: number;
  offset?: number;
}

// Validation functions
export const validateDisplayName = (displayName: string): boolean => {
  return (
    typeof displayName === 'string' &&
    displayName.length >= 1 &&
    displayName.length <= 20 &&
    /^[a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\s]+$/.test(displayName)
  );
};

export const validateDeviceId = (deviceId: string): boolean => {
  return (
    typeof deviceId === 'string' &&
    deviceId.length >= 10 &&
    deviceId.length <= 100 &&
    /^[a-zA-Z0-9\-_]+$/.test(deviceId)
  );
};

export const validatePlayerAuth = (auth: PlayerAuth): boolean => {
  return validateDeviceId(auth.deviceId);
};

// Player state helpers
export const isPlayerConnected = (player: Player): boolean => {
  return player.connection.isConnected;
};

export const isPlayerInGame = (player: Player): boolean => {
  return player.gameState !== undefined;
};

export const hasPlayerLost = (player: Player): boolean => {
  if (!player.gameState) return false;
  
  const { penaltyPile } = player.gameState;
  return Object.values(penaltyPile).some(pile => pile.length >= 3);
};

export const getPlayerPenaltyCount = (player: Player): number => {
  if (!player.gameState) return 0;
  
  const { penaltyPile } = player.gameState;
  return Object.values(penaltyPile).reduce((total, pile) => total + pile.length, 0);
};

export const getPlayerHandCount = (player: Player): number => {
  return player.gameState?.hand.length || 0;
};

export const canPlayerPlay = (player: Player, currentTurn: string): boolean => {
  return (
    player.gameState !== undefined &&
    player.id === currentTurn &&
    player.gameState.hand.length > 0 &&
    !hasPlayerLost(player)
  );
};

// Player statistics helpers
export const calculateWinRate = (stats: PlayerStatistics): number => {
  if (stats.totalGames === 0) return 0;
  return Math.round((stats.wins / stats.totalGames) * 100);
};

export const updateStatistics = (
  stats: PlayerStatistics,
  gameResult: {
    won: boolean;
    duration: number;
    creatureTypesPlayed: string[];
  }
): PlayerStatistics => {
  const newStats = { ...stats };
  
  newStats.totalGames += 1;
  if (gameResult.won) {
    newStats.wins += 1;
    if (!newStats.fastestWin || gameResult.duration < newStats.fastestWin) {
      newStats.fastestWin = gameResult.duration;
    }
  } else {
    newStats.losses += 1;
  }
  
  if (!newStats.longestGame || gameResult.duration > newStats.longestGame) {
    newStats.longestGame = gameResult.duration;
  }
  
  // Update average duration
  newStats.averageGameDuration = Math.round(
    ((newStats.averageGameDuration * (newStats.totalGames - 1)) + gameResult.duration) 
    / newStats.totalGames
  );
  
  // Update creature preferences
  gameResult.creatureTypesPlayed.forEach(creatureType => {
    if (creatureType in newStats.creaturePreferences) {
      const pref = newStats.creaturePreferences[creatureType as keyof typeof newStats.creaturePreferences];
      pref.played += 1;
      if (gameResult.won) {
        pref.won += 1;
      }
    }
  });
  
  newStats.winRate = calculateWinRate(newStats);
  
  return newStats;
};

// Transformation helpers
export const playerRowToPlayer = (row: PlayerRow): Player => ({
  id: row.id,
  deviceId: row.device_id,
  profile: {
    displayName: row.display_name,
    ...(row.avatar !== null && { avatar: row.avatar }),
    preferences: row.preferences || {}
  },
  connection: {
    isConnected: row.is_connected,
    lastSeen: row.last_seen,
    ...(row.connection_id !== null && { connectionId: row.connection_id })
  },
  statistics: row.statistics || createDefaultStatistics(),
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const playerToPlayerRow = (player: Player): Omit<PlayerRow, 'created_at' | 'updated_at'> => ({
  id: player.id,
  device_id: player.deviceId,
  display_name: player.profile.displayName,
  avatar: player.profile.avatar || null,
  is_connected: player.connection.isConnected,
  last_seen: player.connection.lastSeen,
  connection_id: player.connection.connectionId || null,
  preferences: player.profile.preferences || {},
  statistics: player.statistics
});

export const gamePlayerRowToGamePlayer = (
  playerRow: PlayerRow,
  gamePlayerRow: GamePlayerRow
): GamePlayer => {
  const basePlayer = playerRowToPlayer(playerRow);
  
  return {
    ...basePlayer,
    gameId: gamePlayerRow.game_id,
    gameState: {
      hand: gamePlayerRow.hand || [],
      penaltyPile: gamePlayerRow.penalty_pile || {
        cockroach: [],
        mouse: [],
        bat: [],
        frog: []
      },
      turnPosition: gamePlayerRow.turn_position,
      isReady: gamePlayerRow.is_ready,
      score: 0, // Will be calculated from penalty pile
      hasLost: false // Will be calculated from penalty pile
    },
    joinedAt: gamePlayerRow.joined_at
  };
};

// Default values
export const createDefaultStatistics = (): PlayerStatistics => ({
  totalGames: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  averageGameDuration: 0,
  fastestWin: 0,
  longestGame: 0,
  creaturePreferences: {
    cockroach: { played: 0, won: 0 },
    mouse: { played: 0, won: 0 },
    bat: { played: 0, won: 0 },
    frog: { played: 0, won: 0 }
  }
});

export const createDefaultPenaltyPile = () => ({
  cockroach: [],
  mouse: [],
  bat: [],
  frog: []
});

export const createDefaultPlayerGameState = (): PlayerGameState => ({
  hand: [],
  penaltyPile: createDefaultPenaltyPile(),
  turnPosition: 0,
  isReady: false,
  score: 0,
  hasLost: false
});