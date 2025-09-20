/**
 * Security Service for G-Poker
 * Handles game-scoped security, participant ID validation, and access control
 */

import { supabase, authManager, type PublicProfile, type GameParticipant } from './supabase';
import type { CreatureType, GameStatus, PlayerStatus, VerificationStatus } from './supabase';

export interface SecurityValidationResult {
  isValid: boolean;
  error?: string;
  data?: any;
}

export class SecurityService {
  private static instance: SecurityService;

  static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  /**
   * Get current user's public profile with error handling
   */
  async getCurrentUserProfile(): Promise<SecurityValidationResult> {
    try {
      const user = authManager.getCurrentUser();
      if (!user) {
        return { isValid: false, error: 'User not authenticated' };
      }

      const { data: profile, error } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      if (error || !profile) {
        return { isValid: false, error: 'Public profile not found' };
      }

      return { isValid: true, data: profile };
    } catch (error) {
      return { isValid: false, error: 'Failed to get current user profile' };
    }
  }

  /**
   * Validate that user has access to a specific game
   */
  async validateGameAccess(gameId: string): Promise<SecurityValidationResult> {
    try {
      const profileResult = await this.getCurrentUserProfile();
      if (!profileResult.isValid) return profileResult;

      const profile = profileResult.data as PublicProfile;

      // Check if user is a participant in this game
      const { data: participant, error } = await supabase
        .from('game_participants')
        .select('id, status, position')
        .eq('game_id', gameId)
        .eq('player_id', profile.id)
        .neq('status', 'left')
        .single();

      if (error || !participant) {
        return { isValid: false, error: 'Access denied: Not a participant in this game' };
      }

      return { isValid: true, data: participant };
    } catch (error) {
      return { isValid: false, error: 'Failed to validate game access' };
    }
  }

  /**
   * Get participant ID for current user in a specific game (secure game-scoped ID)
   */
  async getParticipantId(gameId: string): Promise<SecurityValidationResult> {
    try {
      const accessResult = await this.validateGameAccess(gameId);
      if (!accessResult.isValid) return accessResult;

      const participant = accessResult.data as GameParticipant;
      return { isValid: true, data: participant.id };
    } catch (error) {
      return { isValid: false, error: 'Failed to get participant ID' };
    }
  }

  /**
   * Validate ENUM values with type safety
   */
  validateEnums(data: {
    creatureType?: string;
    gameStatus?: string;
    playerStatus?: string;
    verificationStatus?: string;
  }): SecurityValidationResult {
    const errors: string[] = [];

    if (data.creatureType !== undefined && !authManager.validateCreatureType(data.creatureType)) {
      errors.push(`Invalid creature type: ${data.creatureType}`);
    }

    if (data.gameStatus !== undefined && !authManager.validateGameStatus(data.gameStatus)) {
      errors.push(`Invalid game status: ${data.gameStatus}`);
    }

    if (data.playerStatus !== undefined && !authManager.validatePlayerStatus(data.playerStatus)) {
      errors.push(`Invalid player status: ${data.playerStatus}`);
    }

    if (data.verificationStatus !== undefined && !authManager.validateVerificationStatus(data.verificationStatus)) {
      errors.push(`Invalid verification status: ${data.verificationStatus}`);
    }

    if (errors.length > 0) {
      return { isValid: false, error: errors.join(', ') };
    }

    return { isValid: true };
  }

  /**
   * Secure participant lookup - ensures participant belongs to the requesting user
   */
  async getSecureParticipant(gameId: string, participantId: string): Promise<SecurityValidationResult> {
    try {
      const accessResult = await this.validateGameAccess(gameId);
      if (!accessResult.isValid) return accessResult;

      const userParticipant = accessResult.data as GameParticipant;

      // Ensure the requested participant ID matches the user's participant ID for this game
      if (userParticipant.id !== participantId) {
        return { isValid: false, error: 'Access denied: Participant ID mismatch' };
      }

      const { data: participant, error } = await supabase
        .from('game_participants')
        .select('*')
        .eq('id', participantId)
        .eq('game_id', gameId)
        .single();

      if (error || !participant) {
        return { isValid: false, error: 'Participant not found' };
      }

      return { isValid: true, data: participant };
    } catch (error) {
      return { isValid: false, error: 'Failed to get secure participant' };
    }
  }

  /**
   * Validate game turn permission
   */
  async validateTurnPermission(gameId: string): Promise<SecurityValidationResult> {
    try {
      const profileResult = await this.getCurrentUserProfile();
      if (!profileResult.isValid) return profileResult;

      const profile = profileResult.data as PublicProfile;

      // Get current game state
      const { data: game, error: gameError } = await supabase
        .from('games')
        .select('current_turn_player_id, status')
        .eq('id', gameId)
        .single();

      if (gameError || !game) {
        return { isValid: false, error: 'Game not found' };
      }

      if (game.status !== 'in_progress') {
        return { isValid: false, error: 'Game is not in progress' };
      }

      if (game.current_turn_player_id !== profile.id) {
        return { isValid: false, error: 'Not your turn' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Failed to validate turn permission' };
    }
  }

  /**
   * Get opponent participant in a 2-player game
   */
  async getOpponentParticipant(gameId: string): Promise<SecurityValidationResult> {
    try {
      const accessResult = await this.validateGameAccess(gameId);
      if (!accessResult.isValid) return accessResult;

      const userParticipant = accessResult.data as GameParticipant;

      // Get the other participant (opponent)
      const { data: opponent, error } = await supabase
        .from('game_participants')
        .select('*')
        .eq('game_id', gameId)
        .neq('id', userParticipant.id)
        .neq('status', 'left')
        .single();

      if (error || !opponent) {
        return { isValid: false, error: 'Opponent not found' };
      }

      return { isValid: true, data: opponent };
    } catch (error) {
      return { isValid: false, error: 'Failed to get opponent participant' };
    }
  }

  /**
   * Verify user permissions for game creator actions
   */
  async validateCreatorPermissions(gameId: string): Promise<SecurityValidationResult> {
    try {
      const profileResult = await this.getCurrentUserProfile();
      if (!profileResult.isValid) return profileResult;

      const profile = profileResult.data as PublicProfile;

      const { data: game, error } = await supabase
        .from('games')
        .select('creator_id')
        .eq('id', gameId)
        .single();

      if (error || !game) {
        return { isValid: false, error: 'Game not found' };
      }

      if (game.creator_id !== profile.id) {
        return { isValid: false, error: 'Access denied: Only game creator can perform this action' };
      }

      return { isValid: true };
    } catch (error) {
      return { isValid: false, error: 'Failed to validate creator permissions' };
    }
  }

  /**
   * Rate limiting check for actions (basic implementation)
   */
  private actionTimestamps = new Map<string, number[]>();

  checkRateLimit(userId: string, actionType: string, maxActions: number = 10, windowMs: number = 60000): SecurityValidationResult {
    const key = `${userId}:${actionType}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get existing timestamps and filter out old ones
    const timestamps = this.actionTimestamps.get(key) || [];
    const validTimestamps = timestamps.filter(ts => ts > windowStart);

    if (validTimestamps.length >= maxActions) {
      return {
        isValid: false,
        error: `Rate limit exceeded: Max ${maxActions} ${actionType} actions per ${windowMs / 1000} seconds`
      };
    }

    // Add current timestamp
    validTimestamps.push(now);
    this.actionTimestamps.set(key, validTimestamps);

    return { isValid: true };
  }
}

// Export singleton instance
export const securityService = SecurityService.getInstance();
export default securityService;