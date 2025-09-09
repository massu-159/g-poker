/**
 * Game Service
 * Database operations for game management, including CRUD, state updates, and queries
 */

import { 
  supabase, 
  gamesTable, 
  roundsTable, 
  gameActionsTable,
  formatSupabaseError
} from './supabase';
import {
  Game,
  GameRow,
  GameStatus,
  CreateGameRequest,
  UpdateGameRequest,
  gameRowToGame,
  validateGameSettings
} from '../lib/entities/Game';
import {
  Player,
  GamePlayer,
  playerRowToPlayer
} from '../lib/entities/Player';
import {
  Round,
  roundRowToRound
} from '../lib/entities/Round';

// Service result interfaces
export interface GameServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface GameListResult {
  games: Game[];
  totalCount: number;
  hasMore: boolean;
}

export interface GameWithPlayers extends Game {
  players: GamePlayer[];
  currentRound?: Round;
}

// Game CRUD operations
export class GameService {
  
  /**
   * Create a new game
   */
  async createGame(request: CreateGameRequest): Promise<GameServiceResult<Game>> {
    try {
      // Validate game settings
      if (!validateGameSettings(request.settings)) {
        return {
          success: false,
          error: {
            code: 'INVALID_SETTINGS',
            message: 'Invalid game settings provided'
          }
        };
      }

      const gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      const gameData = {
        id: gameId,
        status: 'waiting_for_players',
        settings: request.settings as any, // Cast to Json type
        current_turn: null,
        winner_id: null,
        started_at: null,
        ended_at: null
      };

      const { data, error } = await gamesTable()
        .insert(gameData)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'CREATE_GAME_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: gameRowToGame(data as GameRow)
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CREATE_GAME_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to create game'
        }
      };
    }
  }

  /**
   * Get game by ID
   */
  async getGame(gameId: string): Promise<GameServiceResult<Game>> {
    try {
      const { data, error } = await gamesTable()
        .select('*')
        .eq('id', gameId)
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'GET_GAME_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      if (!data) {
        return {
          success: false,
          error: {
            code: 'GAME_NOT_FOUND',
            message: 'Game not found'
          }
        };
      }

      return {
        success: true,
        data: gameRowToGame(data as GameRow)
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_GAME_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to get game'
        }
      };
    }
  }

  /**
   * Get game with players and current round
   */
  async getGameWithPlayers(gameId: string): Promise<GameServiceResult<GameWithPlayers>> {
    try {
      // Get game data
      const gameResult = await this.getGame(gameId);
      if (!gameResult.success || !gameResult.data) {
        return gameResult as GameServiceResult<GameWithPlayers>;
      }

      const game = gameResult.data;

      // Get players in this game
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('game_id', gameId);

      if (playersError) {
        return {
          success: false,
          error: {
            code: playersError.code || 'GET_PLAYERS_ERROR',
            message: formatSupabaseError(playersError)
          }
        };
      }

      // Transform player data
      const players: GamePlayer[] = (playersData || []).map((playerRow: any) => 
        playerRowToPlayer(playerRow) as GamePlayer // Cast to GamePlayer
      );

      // Get current round if exists
      let currentRound: Round | undefined;
      if (game.currentRound) {
        const roundResult = await this.getCurrentRound(gameId);
        if (roundResult.success && roundResult.data) {
          currentRound = roundResult.data;
        }
      }

      const gameWithPlayers: GameWithPlayers = {
        ...game,
        players,
        ...(currentRound ? { currentRound } : {})
      };

      return {
        success: true,
        data: gameWithPlayers
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_GAME_WITH_PLAYERS_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to get game with players'
        }
      };
    }
  }

  /**
   * Update game
   */
  async updateGame(request: UpdateGameRequest): Promise<GameServiceResult<Game>> {
    try {
      const updateQuery = gamesTable()
        .update(request.updates)
        .eq('id', request.gameId);
        
      // Note: Version-based concurrency control not implemented in current schema
      const finalQuery = updateQuery;
        
      const { data, error } = await finalQuery.select().single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: {
              code: 'VERSION_CONFLICT',
              message: 'Game was updated by another user. Please refresh and try again.'
            }
          };
        }

        return {
          success: false,
          error: {
            code: error.code || 'UPDATE_GAME_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: gameRowToGame(data as GameRow)
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UPDATE_GAME_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to update game'
        }
      };
    }
  }

  /**
   * Join a player to a game
   */
  async joinGame(gameId: string, player: Player): Promise<GameServiceResult<GameWithPlayers>> {
    try {
      // First, check if game exists and can be joined
      const gameResult = await this.getGameWithPlayers(gameId);
      if (!gameResult.success || !gameResult.data) {
        return gameResult;
      }

      const game = gameResult.data;

      // Validate game can be joined
      if (game.status !== 'waiting_for_players') {
        return {
          success: false,
          error: {
            code: 'GAME_NOT_JOINABLE',
            message: 'Game is not accepting new players'
          }
        };
      }

      if (game.players.length >= 2) {
        return {
          success: false,
          error: {
            code: 'GAME_FULL',
            message: 'Game is already full'
          }
        };
      }

      // Check if player is already in game
      const existingPlayer = game.players.find(p => p.id === player.id);
      if (existingPlayer) {
        return {
          success: false,
          error: {
            code: 'PLAYER_ALREADY_JOINED',
            message: 'Player is already in this game'
          }
        };
      }

      // In current design, players are created as game-specific
      // Join operation is essentially successful by default

      // Return updated game with players
      return this.getGameWithPlayers(gameId);

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'JOIN_GAME_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to join game'
        }
      };
    }
  }

  /**
   * Leave a game
   */
  async leaveGame(gameId: string, playerId: string): Promise<GameServiceResult<Game>> {
    try {
      const now = new Date().toISOString();

      // Mark player as disconnected
      const { error: leaveError } = await supabase
        .from('players')
        .update({
          is_connected: false,
          last_seen: now
        })
        .eq('game_id', gameId)
        .eq('id', playerId);

      if (leaveError) {
        return {
          success: false,
          error: {
            code: leaveError.code || 'LEAVE_GAME_ERROR',
            message: formatSupabaseError(leaveError)
          }
        };
      }

      // Get current game state
      const gameResult = await this.getGame(gameId);
      if (!gameResult.success || !gameResult.data) {
        return gameResult;
      }

      const game = gameResult.data;

      // Remove player from game's player_ids array
      const updatedPlayerIds = game.playerIds.filter(id => id !== playerId);

      // Determine new game status
      let newStatus = game.status;
      if (updatedPlayerIds.length === 0) {
        newStatus = 'abandoned';
      } else if (game.status === 'in_progress' && updatedPlayerIds.length < 2) {
        newStatus = 'abandoned'; // Can't continue with less than 2 players
      }

      // Update game
      const updateResult = await this.updateGame({
        gameId,
        updates: {
          status: newStatus,
          ...(newStatus === 'abandoned' && { ended_at: now })
        },
        expectedVersion: game.version
      });

      return updateResult;

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'LEAVE_GAME_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to leave game'
        }
      };
    }
  }

  /**
   * Start a game (transition from waiting to in_progress)
   */
  async startGame(gameId: string): Promise<GameServiceResult<Game>> {
    try {
      const gameResult = await this.getGameWithPlayers(gameId);
      if (!gameResult.success || !gameResult.data) {
        return gameResult as GameServiceResult<Game>;
      }

      const game = gameResult.data;

      // Validate game can be started
      if (game.status !== 'waiting_for_players') {
        return {
          success: false,
          error: {
            code: 'GAME_ALREADY_STARTED',
            message: 'Game has already been started'
          }
        };
      }

      if (game.players.length !== 2) {
        return {
          success: false,
          error: {
            code: 'INSUFFICIENT_PLAYERS',
            message: 'Game needs exactly 2 players to start'
          }
        };
      }

      // Check all players are ready
      const allPlayersReady = game.players.every(p => p.gameState.isReady);
      if (!allPlayersReady) {
        return {
          success: false,
          error: {
            code: 'PLAYERS_NOT_READY',
            message: 'All players must be ready to start the game'
          }
        };
      }

      const now = new Date().toISOString();
      const firstPlayer = game.players[0];
      if (!firstPlayer) {
        return {
          success: false,
          error: {
            code: 'NO_PLAYERS',
            message: 'Cannot start game with no players'
          }
        };
      }
      const firstPlayerId = firstPlayer.id;

      // Update game status and state
      const updateResult = await this.updateGame({
        gameId,
        updates: {
          status: 'in_progress',
          started_at: now,
          current_turn: firstPlayerId
        },
        expectedVersion: game.version
      });

      return updateResult;

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'START_GAME_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to start game'
        }
      };
    }
  }

  /**
   * End a game
   */
  async endGame(gameId: string, winnerId?: string): Promise<GameServiceResult<Game>> {
    try {
      const gameResult = await this.getGame(gameId);
      if (!gameResult.success || !gameResult.data) {
        return gameResult;
      }

      const game = gameResult.data;

      if (game.status === 'ended' || game.status === 'abandoned') {
        return {
          success: false,
          error: {
            code: 'GAME_ALREADY_ENDED',
            message: 'Game has already ended'
          }
        };
      }

      const now = new Date().toISOString();

      const updateResult = await this.updateGame({
        gameId,
        updates: {
          status: 'ended',
          ended_at: now,
          winner_id: winnerId || null
        },
        expectedVersion: game.version
      });

      return updateResult;

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'END_GAME_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to end game'
        }
      };
    }
  }

  /**
   * Get current round for a game
   */
  async getCurrentRound(gameId: string): Promise<GameServiceResult<Round>> {
    try {
      const { data, error } = await roundsTable()
        .select('*')
        .eq('game_id', gameId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: {
              code: 'NO_ACTIVE_ROUND',
              message: 'No active round found'
            }
          };
        }

        return {
          success: false,
          error: {
            code: error.code || 'GET_ROUND_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: roundRowToRound(data as any) // Cast due to schema mismatch
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_ROUND_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to get current round'
        }
      };
    }
  }

  /**
   * Get game history (actions)
   */
  async getGameHistory(gameId: string, limit: number = 100): Promise<GameServiceResult<any[]>> {
    try {
      const { data, error } = await gameActionsTable()
        .select('*')
        .eq('game_id', gameId)
        .order('sequence_number', { ascending: true })
        .limit(limit);

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'GET_HISTORY_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: data || []
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_HISTORY_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to get game history'
        }
      };
    }
  }

  /**
   * Record game action
   */
  async recordAction(gameId: string, playerId: string, actionType: string, actionData: any): Promise<GameServiceResult<void>> {
    try {
      // Sequence numbers not implemented in current schema

      const { error } = await gameActionsTable()
        .insert({
          game_id: gameId,
          player_id: playerId,
          action_type: actionType,
          action_data: actionData
        });

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'RECORD_ACTION_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RECORD_ACTION_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to record action'
        }
      };
    }
  }

  /**
   * List games with filters
   */
  async listGames(filters: {
    status?: GameStatus;
    playerId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<GameServiceResult<GameListResult>> {
    try {
      let query = gamesTable().select('*', { count: 'exact' });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.playerId) {
        query = query.contains('player_ids', [filters.playerId]);
      }

      // Apply pagination
      const limit = filters.limit || 20;
      const offset = filters.offset || 0;
      
      query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'LIST_GAMES_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      const games = (data || []).map((row: any) => gameRowToGame(row as GameRow));
      const totalCount = count || 0;
      const hasMore = offset + limit < totalCount;

      return {
        success: true,
        data: {
          games,
          totalCount,
          hasMore
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'LIST_GAMES_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to list games'
        }
      };
    }
  }

  /**
   * Cleanup abandoned games
   */
  async cleanupAbandonedGames(olderThanHours: number = 24): Promise<GameServiceResult<number>> {
    try {
      const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000)).toISOString();

      const { data, error } = await gamesTable()
        .update({
          status: 'abandoned',
          ended_at: new Date().toISOString()
        })
        .eq('status', 'waiting_for_players')
        .lt('created_at', cutoffTime)
        .select();

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'CLEANUP_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: data?.length || 0
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CLEANUP_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to cleanup games'
        }
      };
    }
  }
}

// Export singleton instance
export const gameService = new GameService();