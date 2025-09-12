/**
 * Authentication Service
 * Manages player authentication using traditional OAuth and Email methods
 */

import {
  supabase,
  playersTable,
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
  validateDisplayName,
  createDefaultStatistics
} from '../lib/entities/Player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
// OAuth provider types
export type AuthProvider = 'apple' | 'email';

// Authentication result interfaces
export interface AuthResult {
  success: boolean;
  data?: {
    player: Player | null;
    session: any;
    requiresEmailConfirmation?: boolean;
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
    player?: Player | null;
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
   * Sign in with Apple
   */
  async signInWithApple(): Promise<AuthResult> {
    try {
      // Check if Apple Authentication is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        return {
          success: false,
          error: {
            code: 'APPLE_AUTH_UNAVAILABLE',
            message: 'Apple Sign-In is not available on this device'
          }
        };
      }

      // Request Apple authentication
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Sign in to Supabase with Apple ID token
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'APPLE_SUPABASE_ERROR',
            message: error.message
          }
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: {
            code: 'NO_SESSION_CREATED',
            message: 'Failed to create session'
          }
        };
      }

      // Try to get existing player record (will be null for new users)
      const player = await this.getOrCreatePlayerFromUser(data.user);
      
      // Return success with session, player will be created when joining a game
      return {
        success: true,
        data: {
          player,
          session: data.session
        }
      };

    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
        return {
          success: false,
          error: {
            code: 'USER_CANCELED',
            message: 'Apple Sign-In was canceled'
          }
        };
      }

      return {
        success: false,
        error: {
          code: 'APPLE_AUTH_ERROR',
          message: error instanceof Error ? error.message : 'Apple Sign-In failed'
        }
      };
    }
  }


  /**
   * Sign in with Email and Password
   */
  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'EMAIL_AUTH_ERROR',
            message: error.message
          }
        };
      }

      if (!data.user || !data.session) {
        return {
          success: false,
          error: {
            code: 'NO_SESSION_CREATED',
            message: 'Failed to create session'
          }
        };
      }

      // Try to get existing player record (will be null for new users)
      const player = await this.getOrCreatePlayerFromUser(data.user);
      
      // Return success with session, player will be created when joining a game
      return {
        success: true,
        data: {
          player,
          session: data.session
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EMAIL_AUTH_EXCEPTION',
          message: error instanceof Error ? error.message : 'Email sign-in failed'
        }
      };
    }
  }

  /**
   * Sign up with Email and Password
   */
  async signUpWithEmail(email: string, password: string, displayName: string): Promise<AuthResult> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          data: {
            display_name: displayName,
          }
        }
      });

      if (error) {
        return {
          success: false,
          error: {
            code: 'EMAIL_SIGNUP_ERROR',
            message: error.message
          }
        };
      }

      if (!data.user) {
        return {
          success: false,
          error: {
            code: 'NO_USER_CREATED',
            message: 'Failed to create user account'
          }
        };
      }

      // If email confirmation is required, session will be null
      if (!data.session) {
        return {
          success: true,
          data: {
            player: null as Player | null,
            session: null,
            requiresEmailConfirmation: true
          }
        };
      }

      // Try to get existing player record (will be null for new users)
      const player = await this.getOrCreatePlayerFromUser(data.user);
      
      // Return success with session, player will be created when joining a game
      return {
        success: true,
        data: {
          player,
          session: data.session
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'EMAIL_SIGNUP_EXCEPTION',
          message: error instanceof Error ? error.message : 'Email sign-up failed'
        }
      };
    }
  }

  /**
   * Legacy method - kept for backward compatibility
   * @deprecated Use social auth methods instead
   */
  async authenticateWithDeviceId(deviceId: string, gameId: string, displayName?: string): Promise<AuthResult> {
    // Redirect to email signup as fallback
    return {
      success: false,
      error: {
        code: 'DEPRECATED_METHOD',
        message: 'Please use social authentication methods'
      }
    };
  }

  /**
   * Legacy method - kept for backward compatibility  
   * @deprecated Use social auth methods instead
   */
  async authenticateAnonymously(gameId: string, displayName?: string): Promise<AuthResult> {
    return this.authenticateWithDeviceId('', gameId, displayName);
  }

  /**
   * Get current authenticated player
   */
  async getCurrentPlayer(): Promise<SessionResult> {
    try {
      const session = await getCurrentSession();
      
      if (!session || !session.user) {
        return {
          success: true,
          data: {
            isAuthenticated: false
          }
        };
      }

      // Get player data from authenticated user
      const player = await this.getOrCreatePlayerFromUser(session.user);
      
      // Player may be null for new users - they will be created when joining a game
      return {
        success: true,
        data: {
          isAuthenticated: true,
          player,
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
      // Validate display name
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
   * Get or create player from authenticated user
   * Note: Temporarily adapts user auth to existing device-based schema
   */
  private async getOrCreatePlayerFromUser(user: any): Promise<Player | null> {
    try {
      // Try to get existing player by device ID (use user.id as device_id for now)
      const deviceId = user.id; // Use user ID as device ID temporarily
      
      const { data: existingPlayers, error: getError } = await playersTable()
        .select('*')
        .eq('device_id', deviceId);

      // Return first matching player if found
      if (existingPlayers && existingPlayers.length > 0) {
        const playerRow = existingPlayers[0];
        if (playerRow) {
          return playerRowToPlayer(playerRow);
        }
      }

      // If error and not "no rows returned", return null
      if (getError && getError.code !== 'PGRST116') {
        console.error('Error fetching player:', getError);
        return null;
      }

      // For now, return null since player creation requires a game_id
      // Players will be created when they join a specific game
      // This maintains compatibility with existing game flow
      console.log('Player not found, will be created when joining a game');
      return null;

    } catch (error) {
      console.error('Error in getOrCreatePlayerFromUser:', error);
      return null;
    }
  }

  /**
   * Get authentication provider information
   */
  async getAuthProvider(): Promise<{ provider: string; isEmailConfirmed: boolean } | null> {
    try {
      const session = await getCurrentSession();
      if (!session?.user) return null;

      const provider = session.user.app_metadata?.provider || 'email';
      const isEmailConfirmed = session.user.email_confirmed_at != null;

      return {
        provider,
        isEmailConfirmed
      };
    } catch (error) {
      console.error('Failed to get auth provider:', error);
      return null;
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
      const currentPlayerResult = await this.getCurrentPlayer();
      
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

