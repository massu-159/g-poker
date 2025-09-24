/**
 * Profile Management Service for G-Poker
 * Handles profile operations, statistics, and settings management
 */

import { supabase, authManager } from './supabase';
import type {
  PublicProfile,
  PublicProfileUpdate,
  Profile,
  VerificationStatus
} from '@/types/database';

export interface ProfileStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  winRate: number;
  averageGameDuration?: number;
  favoriteCreatureType?: string;
  longestWinStreak?: number;
  totalPlayTime?: number;
}

export interface GamePreferences {
  preferredTimeLimit: number; // seconds
  allowSpectators: boolean;
  autoJoinGames: boolean;
  soundEnabled: boolean;
  hapticFeedback: boolean;
  animationsEnabled: boolean;
}

export interface NotificationSettings {
  gameInvites: boolean;
  turnReminders: boolean;
  gameResults: boolean;
  achievements: boolean;
  marketing: boolean;
}

export interface UserSettings {
  gamePreferences: GamePreferences;
  notifications: NotificationSettings;
  privacy: {
    showOnlineStatus: boolean;
    allowFriendRequests: boolean;
    showStatistics: boolean;
  };
}

export class ProfileService {
  private static instance: ProfileService;

  private constructor() {}

  static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }

  /**
   * Get current user's public profile
   */
  async getCurrentProfile(): Promise<{ profile: PublicProfile | null; error?: string }> {
    try {
      const user = authManager.getCurrentUser();
      if (!user) {
        return { profile: null, error: 'User not authenticated' };
      }

      const { data: profile, error } = await supabase
        .from('public_profiles')
        .select('*')
        .eq('profile_id', user.id)
        .single();

      if (error) {
        console.error('Failed to get current profile:', error);
        return { profile: null, error: error.message };
      }

      return { profile };
    } catch (error: any) {
      console.error('Failed to get current profile:', error);
      return { profile: null, error: error.message || 'Failed to get profile' };
    }
  }

  /**
   * Update user's public profile
   */
  async updateProfile(updates: Partial<PublicProfileUpdate>): Promise<{ success: boolean; error?: string; profile?: PublicProfile }> {
    try {
      const user = authManager.getCurrentUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // Add updated timestamp
      const profileUpdates = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data: profile, error } = await supabase
        .from('public_profiles')
        .update(profileUpdates)
        .eq('profile_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Failed to update profile:', error);
        return { success: false, error: error.message };
      }

      return { success: true, profile };
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      return { success: false, error: error.message || 'Failed to update profile' };
    }
  }

  /**
   * Get comprehensive user statistics
   */
  async getUserStatistics(userId?: string): Promise<{ stats: ProfileStats | null; error?: string }> {
    try {
      const targetUserId = userId || authManager.getCurrentUser()?.id;
      if (!targetUserId) {
        return { stats: null, error: 'User not specified' };
      }

      // Get basic stats from public profile
      const { data: profile, error: profileError } = await supabase
        .from('public_profiles')
        .select('games_played, games_won, win_rate')
        .eq('profile_id', targetUserId)
        .single();

      if (profileError) {
        console.error('Failed to get profile stats:', profileError);
        return { stats: null, error: profileError.message };
      }

      // Calculate additional statistics from game data
      const { data: gameParticipants, error: gameError } = await supabase
        .from('game_participants')
        .select(`
          has_lost,
          joined_at,
          updated_at,
          games!inner(status, created_at, updated_at)
        `)
        .eq('player_id', targetUserId);

      if (gameError) {
        console.error('Failed to get game history:', gameError);
        // Return basic stats even if detailed stats fail
        return {
          stats: {
            gamesPlayed: profile.games_played,
            gamesWon: profile.games_won,
            gamesLost: profile.games_played - profile.games_won,
            winRate: profile.win_rate,
          }
        };
      }

      // Calculate detailed statistics
      const completedGames = gameParticipants?.filter(p => p.games?.status === 'completed') || [];
      const totalGames = completedGames.length;
      const wonGames = completedGames.filter(p => !p.has_lost).length;
      const lostGames = totalGames - wonGames;

      // Calculate average game duration (if data available)
      let averageGameDuration: number | undefined;
      if (completedGames.length > 0) {
        const durations = completedGames
          .filter(p => p.games?.created_at && p.games?.updated_at)
          .map(p => {
            const start = new Date(p.games!.created_at).getTime();
            const end = new Date(p.games!.updated_at).getTime();
            return (end - start) / 1000; // seconds
          });

        if (durations.length > 0) {
          averageGameDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        }
      }

      const stats: ProfileStats = {
        gamesPlayed: totalGames,
        gamesWon: wonGames,
        gamesLost: lostGames,
        winRate: totalGames > 0 ? (wonGames / totalGames) * 100 : 0,
        averageGameDuration,
      };

      return { stats };
    } catch (error: any) {
      console.error('Failed to get user statistics:', error);
      return { stats: null, error: error.message || 'Failed to get statistics' };
    }
  }

  /**
   * Get user settings with defaults
   */
  async getUserSettings(): Promise<{ settings: UserSettings; error?: string }> {
    try {
      const user = authManager.getCurrentUser();
      if (!user) {
        return {
          settings: this.getDefaultSettings(),
          error: 'User not authenticated'
        };
      }

      // For now, return default settings
      // In the future, this could be stored in a user_settings table
      const settings = this.getDefaultSettings();

      return { settings };
    } catch (error: any) {
      console.error('Failed to get user settings:', error);
      return {
        settings: this.getDefaultSettings(),
        error: error.message || 'Failed to get settings'
      };
    }
  }

  /**
   * Update user settings
   */
  async updateSettings(settings: Partial<UserSettings>): Promise<{ success: boolean; error?: string }> {
    try {
      const user = authManager.getCurrentUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // For now, just store in localStorage
      // In the future, this could be stored in a user_settings table
      const currentSettings = await this.getUserSettings();
      const updatedSettings = {
        ...currentSettings.settings,
        ...settings,
      };

      // Store in localStorage for persistence
      try {
        localStorage.setItem(
          `user_settings_${user.id}`,
          JSON.stringify(updatedSettings)
        );
      } catch (storageError) {
        // localStorage not available (React Native)
        console.warn('localStorage not available for settings storage');
      }

      return { success: true };
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      return { success: false, error: error.message || 'Failed to update settings' };
    }
  }

  /**
   * Upload and update user avatar
   */
  async updateAvatar(imageUri: string): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
    try {
      const user = authManager.getCurrentUser();
      if (!user) {
        return { success: false, error: 'User not authenticated' };
      }

      // For now, just update with the provided URI
      // In a real implementation, you would upload to Supabase Storage
      const { success, error, profile } = await this.updateProfile({
        avatar_url: imageUri,
      });

      if (!success) {
        return { success: false, error };
      }

      return {
        success: true,
        avatarUrl: profile?.avatar_url || undefined
      };
    } catch (error: any) {
      console.error('Failed to update avatar:', error);
      return { success: false, error: error.message || 'Failed to update avatar' };
    }
  }

  /**
   * Request profile verification
   */
  async requestVerification(): Promise<{ success: boolean; error?: string }> {
    try {
      const { success, error } = await this.updateProfile({
        verification_status: 'pending',
      });

      return { success, error };
    } catch (error: any) {
      console.error('Failed to request verification:', error);
      return { success: false, error: error.message || 'Failed to request verification' };
    }
  }

  /**
   * Get default user settings
   */
  private getDefaultSettings(): UserSettings {
    return {
      gamePreferences: {
        preferredTimeLimit: 30,
        allowSpectators: true,
        autoJoinGames: false,
        soundEnabled: true,
        hapticFeedback: true,
        animationsEnabled: true,
      },
      notifications: {
        gameInvites: true,
        turnReminders: true,
        gameResults: true,
        achievements: true,
        marketing: false,
      },
      privacy: {
        showOnlineStatus: true,
        allowFriendRequests: true,
        showStatistics: true,
      },
    };
  }

  /**
   * Validate display name
   */
  validateDisplayName(displayName: string): { valid: boolean; error?: string } {
    if (!displayName || displayName.trim().length === 0) {
      return { valid: false, error: 'Display name is required' };
    }

    if (displayName.length < 2) {
      return { valid: false, error: 'Display name must be at least 2 characters' };
    }

    if (displayName.length > 20) {
      return { valid: false, error: 'Display name must be 20 characters or less' };
    }

    if (!/^[a-zA-Z0-9_\s-]+$/.test(displayName)) {
      return { valid: false, error: 'Display name can only contain letters, numbers, spaces, underscores, and hyphens' };
    }

    return { valid: true };
  }
}

// Export singleton instance
export const profileService = ProfileService.getInstance();