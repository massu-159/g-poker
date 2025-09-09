/**
 * Authentication Service
 * Manages player authentication, sessions, and profile management using device-based auth
 */

import {
  supabase,
  playersTable,
  createDeviceSession,
  getCurrentSession,
  signOut,
  formatSupabaseError
} from './supabase';
import {
  Player,
  PlayerAuth,
  PlayerProfile,
  CreatePlayerRequest,
  UpdatePlayerRequest,
  playerRowToPlayer,
  playerToPlayerRow,
  validateDeviceId,
  validateDisplayName,
  createDefaultStatistics
} from '../lib/entities/Player';

// Authentication result interfaces
export interface AuthResult {
  success: boolean;
  data?: {
    player: Player;
    session: any;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface ProfileResult {
  success: boolean;
  data?: Player;
  error?: {
    code: string;
    message: string;
  };
}

export interface SessionResult {
  success: boolean;
  data?: {
    isAuthenticated: boolean;
    player?: Player;
    session?: any;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * AuthService handles player authentication and profile management
 */
export class AuthService {

  /**
   * Authenticate with device ID (primary authentication method)
   */
  async authenticateWithDeviceId(deviceId: string, gameId: string, displayName?: string): Promise<AuthResult> {
    try {
      // Validate device ID
      if (!validateDeviceId(deviceId)) {
        return {
          success: false,
          error: {
            code: 'INVALID_DEVICE_ID',
            message: 'Invalid device ID format'
          }
        };
      }

      // Check if player already exists in this game
      const existingPlayerResult = await this.getPlayerByDeviceAndGame(deviceId, gameId);
      
      if (existingPlayerResult.success && existingPlayerResult.data) {
        // Player exists, create session and return
        const sessionResult = await createDeviceSession(deviceId);
        
        if (!sessionResult.success) {
          return {
            success: false,
            error: {
              code: 'SESSION_CREATE_FAILED',
              message: sessionResult.error || 'Failed to create session'
            }
          };
        }

        // Update last seen
        await this.updatePlayerConnection(existingPlayerResult.data.id, {
          isConnected: true,
          lastSeen: new Date().toISOString()
        });

        return {
          success: true,
          data: {
            player: existingPlayerResult.data,
            session: sessionResult.session
          }
        };
      }

      // Player doesn't exist, create new player
      const createPlayerResult = await this.createPlayer({
        deviceId,
        gameId,
        displayName: displayName || `Player_${deviceId.slice(-6)}`
      });

      if (!createPlayerResult.success) {
        return {
          success: false,
          error: createPlayerResult.error || {
            code: 'CREATE_PLAYER_FAILED',
            message: 'Failed to create player'
          }
        };
      }

      // Create session for new player
      const sessionResult = await createDeviceSession(deviceId);
      
      if (!sessionResult.success) {
        return {
          success: false,
          error: {
            code: 'SESSION_CREATE_FAILED',
            message: sessionResult.error || 'Failed to create session'
          }
        };
      }

      return {
        success: true,
        data: {
          player: createPlayerResult.data!,
          session: sessionResult.session
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'AUTH_EXCEPTION',
          message: error instanceof Error ? error.message : 'Authentication failed'
        }
      };
    }
  }

  /**
   * Get current authenticated player for a specific game
   */
  async getCurrentPlayer(gameId: string): Promise<SessionResult> {
    try {
      const session = await getCurrentSession();
      
      if (!session) {
        return {
          success: true,
          data: {
            isAuthenticated: false
          }
        };
      }

      // Extract device ID from session metadata
      const deviceId = session.user?.user_metadata?.['device_id'];
      
      if (!deviceId) {
        return {
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: 'Session does not contain device ID'
          }
        };
      }

      // Get player data for specific game
      const playerResult = await this.getPlayerByDeviceAndGame(deviceId, gameId);
      
      if (!playerResult.success || !playerResult.data) {
        return {
          success: false,
          error: playerResult.error || {
            code: 'PLAYER_NOT_FOUND',
            message: 'Player not found'
          }
        };
      }

      return {
        success: true,
        data: {
          isAuthenticated: true,
          player: playerResult.data!,
          session
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_CURRENT_PLAYER_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to get current player'
        }
      };
    }
  }

  /**
   * Create a new player
   */
  async createPlayer(request: CreatePlayerRequest): Promise<ProfileResult> {
    try {
      // Validate inputs
      if (!validateDeviceId(request.deviceId)) {
        return {
          success: false,
          error: {
            code: 'INVALID_DEVICE_ID',
            message: 'Invalid device ID format'
          }
        };
      }

      if (!validateDisplayName(request.displayName)) {
        return {
          success: false,
          error: {
            code: 'INVALID_DISPLAY_NAME',
            message: 'Display name must be 1-20 characters, alphanumeric and Japanese characters only'
          }
        };
      }

      // Check if device ID already exists in this game
      const existingResult = await this.getPlayerByDeviceAndGame(request.deviceId, request.gameId);
      if (existingResult.success) {
        return {
          success: false,
          error: {
            code: 'PLAYER_ALREADY_IN_GAME',
            message: 'A player with this device ID already exists in this game'
          }
        };
      }

      // Create player data
      const playerData = {
        game_id: request.gameId,
        device_id: request.deviceId,
        display_name: request.displayName,
        is_connected: true,
        last_seen: new Date().toISOString(),
        joined_at: new Date().toISOString()
      };

      const { data, error } = await playersTable()
        .insert(playerData)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'CREATE_PLAYER_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: playerRowToPlayer(data)
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CREATE_PLAYER_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to create player'
        }
      };
    }
  }

  /**
   * Get player by device ID and game ID
   */
  async getPlayerByDeviceAndGame(deviceId: string, gameId: string): Promise<ProfileResult> {
    try {
      const { data, error } = await playersTable()
        .select('*')
        .eq('device_id', deviceId)
        .eq('game_id', gameId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: {
              code: 'PLAYER_NOT_FOUND',
              message: 'Player not found'
            }
          };
        }

        return {
          success: false,
          error: {
            code: error.code || 'GET_PLAYER_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: playerRowToPlayer(data)
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_PLAYER_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to get player'
        }
      };
    }
  }

  /**
   * Get player by ID
   */
  async getPlayerById(playerId: string): Promise<ProfileResult> {
    try {
      const { data, error } = await playersTable()
        .select('*')
        .eq('id', playerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: false,
            error: {
              code: 'PLAYER_NOT_FOUND',
              message: 'Player not found'
            }
          };
        }

        return {
          success: false,
          error: {
            code: error.code || 'GET_PLAYER_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: playerRowToPlayer(data)
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_PLAYER_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to get player'
        }
      };
    }
  }

  /**
   * Update player profile
   */
  async updateProfile(playerId: string, updates: {
    displayName?: string;
    avatar?: string;
    preferences?: any;
  }): Promise<ProfileResult> {
    try {
      // Validate display name if provided
      if (updates.displayName && !validateDisplayName(updates.displayName)) {
        return {
          success: false,
          error: {
            code: 'INVALID_DISPLAY_NAME',
            message: 'Display name must be 1-20 characters, alphanumeric and Japanese characters only'
          }
        };
      }

      const updateData: any = {};
      
      if (updates.displayName) updateData.display_name = updates.displayName;
      if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
      if (updates.preferences) updateData.preferences = updates.preferences;
      
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await playersTable()
        .update(updateData)
        .eq('id', playerId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'UPDATE_PROFILE_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: playerRowToPlayer(data)
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UPDATE_PROFILE_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to update profile'
        }
      };
    }
  }

  /**
   * Update player connection status
   */
  async updatePlayerConnection(playerId: string, connectionData: {
    isConnected: boolean;
    lastSeen: string;
    connectionId?: string;
  }): Promise<ProfileResult> {
    try {
      const updateData = {
        is_connected: connectionData.isConnected,
        last_seen: connectionData.lastSeen,
        connection_id: connectionData.connectionId || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await playersTable()
        .update(updateData)
        .eq('id', playerId)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'UPDATE_CONNECTION_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: playerRowToPlayer(data)
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'UPDATE_CONNECTION_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to update connection'
        }
      };
    }
  }

  // Note: Statistics tracking removed as current schema doesn't include statistics field

  /**
   * Sign out current player from a specific game
   */
  async signOut(gameId: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
    try {
      // Get current player to update connection status
      const currentPlayerResult = await this.getCurrentPlayer(gameId);
      
      if (currentPlayerResult.success && currentPlayerResult.data?.player) {
        // Mark as disconnected
        await this.updatePlayerConnection(currentPlayerResult.data.player.id, {
          isConnected: false,
          lastSeen: new Date().toISOString()
        });
      }

      // Sign out from Supabase
      const success = await signOut();
      
      if (!success) {
        return {
          success: false,
          error: {
            code: 'SIGNOUT_FAILED',
            message: 'Failed to sign out'
          }
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SIGNOUT_EXCEPTION',
          message: error instanceof Error ? error.message : 'Sign out failed'
        }
      };
    }
  }

  /**
   * Get multiple players by IDs
   */
  async getPlayersByIds(playerIds: string[]): Promise<{
    success: boolean;
    data?: Player[];
    error?: { code: string; message: string };
  }> {
    try {
      if (playerIds.length === 0) {
        return {
          success: true,
          data: []
        };
      }

      const { data, error } = await playersTable()
        .select('*')
        .in('id', playerIds);

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'GET_PLAYERS_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      const players = (data || []).map(row => playerRowToPlayer(row));

      return {
        success: true,
        data: players
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_PLAYERS_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to get players'
        }
      };
    }
  }

  /**
   * Check if a display name is available
   */
  async isDisplayNameAvailable(displayName: string, excludePlayerId?: string): Promise<{
    success: boolean;
    data?: boolean;
    error?: { code: string; message: string };
  }> {
    try {
      if (!validateDisplayName(displayName)) {
        return {
          success: false,
          error: {
            code: 'INVALID_DISPLAY_NAME',
            message: 'Invalid display name format'
          }
        };
      }

      let query = playersTable()
        .select('id')
        .eq('display_name', displayName);

      if (excludePlayerId) {
        query = query.neq('id', excludePlayerId);
      }

      const { data, error } = await query;

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'CHECK_NAME_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: data.length === 0
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CHECK_NAME_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to check display name'
        }
      };
    }
  }

  /**
   * Get online players count
   */
  async getOnlinePlayersCount(): Promise<{
    success: boolean;
    data?: number;
    error?: { code: string; message: string };
  }> {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      const { count, error } = await playersTable()
        .select('*', { count: 'exact', head: true })
        .eq('is_connected', true)
        .gte('last_seen', fiveMinutesAgo);

      if (error) {
        return {
          success: false,
          error: {
            code: error.code || 'COUNT_PLAYERS_ERROR',
            message: formatSupabaseError(error)
          }
        };
      }

      return {
        success: true,
        data: count || 0
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'COUNT_PLAYERS_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to count online players'
        }
      };
    }
  }

  /**
   * Cleanup inactive players (mark as disconnected)
   */
  async cleanupInactivePlayers(inactiveThresholdMinutes: number = 10): Promise<{
    success: boolean;
    data?: number;
    error?: { code: string; message: string };
  }> {
    try {
      const thresholdTime = new Date(Date.now() - inactiveThresholdMinutes * 60 * 1000).toISOString();

      const { data, error } = await playersTable()
        .update({
          is_connected: false,
          connection_id: null,
          updated_at: new Date().toISOString()
        })
        .eq('is_connected', true)
        .lt('last_seen', thresholdTime)
        .select('id');

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
          message: error instanceof Error ? error.message : 'Failed to cleanup inactive players'
        }
      };
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

