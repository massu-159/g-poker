/**
 * Profile Service
 * Integrates with ApiClient for user profile operations
 *
 * Provides methods for:
 * - Fetching user profiles (own or other users)
 * - Updating profile information
 * - Retrieving user statistics
 */

import { apiClient } from '../ApiClient';

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PublicProfile {
  id: string;
  username?: string;
  display_name: string;
  avatar_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface ProfileStats {
  games_played: number;
  games_won: number;
  win_rate: number;
  total_play_time?: number;
  period_days?: number;
}

/**
 * Profile Service Class
 * Handles all user profile-related operations
 */
class ProfileService {
  /**
   * Get user profile
   * If userId is provided, fetches public profile of that user
   * If userId is not provided, fetches current user's full profile
   */
  async getProfile(userId?: string): Promise<ServiceResponse<PublicProfile>> {
    try {
      if (userId) {
        // Fetch public profile of another user
        console.log('[ProfileService] Getting public profile for user:', userId);
        const response = await apiClient.getUserPublicProfile(userId);

        if (response.success && response.data) {
          return {
            success: true,
            data: {
              id: response.data.id,
              username: response.data.username,
              display_name: response.data.displayName,
              avatar_url: response.data.avatarUrl,
              created_at: response.data.createdAt,
            },
          };
        }

        return {
          success: false,
          error: response.error || 'Failed to get user profile',
        };
      } else {
        // Fetch current user's full profile
        console.log('[ProfileService] Getting current user profile');
        const response = await apiClient.getUsersMe();

        if (response.success && response.data) {
          return {
            success: true,
            data: {
              id: response.data.id,
              username: response.data.username,
              display_name: response.data.displayName,
              avatar_url: response.data.avatarUrl,
              created_at: response.data.createdAt,
              updated_at: response.data.updatedAt,
            },
          };
        }

        return {
          success: false,
          error: response.error || 'Failed to get profile',
        };
      }
    } catch (error: any) {
      console.error('[ProfileService] getProfile error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get profile',
      };
    }
  }

  /**
   * Update current user's profile
   */
  async updateProfile(updates: {
    display_name?: string;
    avatar_url?: string;
  }): Promise<ServiceResponse<PublicProfile>> {
    try {
      console.log('[ProfileService] Updating profile:', updates);

      const response = await apiClient.updateUserProfile({
        displayName: updates.display_name,
        avatarUrl: updates.avatar_url,
      });

      if (response.success && response.data) {
        return {
          success: true,
          data: {
            id: response.data.id,
            display_name: response.data.displayName,
            avatar_url: response.data.avatarUrl,
            created_at: response.data.createdAt,
            updated_at: response.data.updatedAt,
          },
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to update profile',
      };
    } catch (error: any) {
      console.error('[ProfileService] updateProfile error:', error);
      return {
        success: false,
        error: error.message || 'Failed to update profile',
      };
    }
  }

  /**
   * Get user statistics
   * Fetches game statistics for current user
   */
  async getProfileStats(userId?: string, days: number = 30): Promise<ServiceResponse<ProfileStats>> {
    try {
      console.log('[ProfileService] Getting profile stats');

      // Note: Backend API only supports current user's stats
      // userId parameter is kept for backwards compatibility
      const response = await apiClient.getUserStatistics(days);

      if (response.success && response.data) {
        const stats = response.data.statistics.activitySummary;
        return {
          success: true,
          data: {
            games_played: stats.total_games_played,
            games_won: stats.total_games_won,
            win_rate: stats.win_rate,
            period_days: stats.period_days,
          },
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to get profile stats',
      };
    } catch (error: any) {
      console.error('[ProfileService] getProfileStats error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get profile stats',
      };
    }
  }

  /**
   * Get user game history
   */
  async getUserGames(page: number = 1, limit: number = 20): Promise<ServiceResponse<any>> {
    try {
      console.log('[ProfileService] Getting user games:', { page, limit });

      const response = await apiClient.getUserGames(page, limit);

      if (response.success && response.data) {
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to get user games',
      };
    } catch (error: any) {
      console.error('[ProfileService] getUserGames error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get user games',
      };
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(preferences: {
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
    soundEnabled?: boolean;
    soundVolume?: number;
    mobileCardSize?: 'small' | 'medium' | 'large';
    mobileVibrationEnabled?: boolean;
    mobileNotificationsEnabled?: boolean;
  }): Promise<ServiceResponse<any>> {
    try {
      console.log('[ProfileService] Updating preferences:', preferences);

      const response = await apiClient.updateUserPreferences(preferences);

      if (response.success) {
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to update preferences',
      };
    } catch (error: any) {
      console.error('[ProfileService] updatePreferences error:', error);
      return {
        success: false,
        error: error.message || 'Failed to update preferences',
      };
    }
  }

  /**
   * Mark tutorial as completed
   */
  async markTutorialComplete(): Promise<ServiceResponse<any>> {
    try {
      console.log('[ProfileService] Marking tutorial as completed');

      const response = await apiClient.markTutorialComplete();

      if (response.success) {
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to mark tutorial complete',
      };
    } catch (error: any) {
      console.error('[ProfileService] markTutorialComplete error:', error);
      return {
        success: false,
        error: error.message || 'Failed to mark tutorial complete',
      };
    }
  }
}

export const profileService = new ProfileService();
