/**
 * Profile Service Stub
 * TODO: Migrate to ApiClient pattern
 * This is a temporary stub to unblock compilation
 */

import { apiClient } from '../ApiClient';

export interface PublicProfile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  created_at: string;
}

export interface ProfileStats {
  games_played: number;
  games_won: number;
  win_rate: number;
  total_play_time: number;
}

class ProfileService {
  async getProfile(userId?: string): Promise<PublicProfile | null> {
    const response = await apiClient.getProfile(userId);
    if (response.success && response.data) {
      return {
        id: response.data.id,
        username: response.data.username,
        display_name: response.data.displayName,
        avatar_url: response.data.avatarUrl,
        created_at: response.data.createdAt,
      };
    }
    return null;
  }

  async updateProfile(updates: Partial<PublicProfile>): Promise<PublicProfile | null> {
    const response = await apiClient.updateProfile({
      displayName: updates.display_name,
      avatarUrl: updates.avatar_url,
    });
    if (response.success && response.data) {
      return {
        id: response.data.id,
        username: response.data.username,
        display_name: response.data.displayName,
        avatar_url: response.data.avatarUrl,
        created_at: response.data.createdAt,
      };
    }
    return null;
  }

  async getProfileStats(userId?: string): Promise<ProfileStats> {
    // TODO: Implement stats endpoint in backend
    return {
      games_played: 0,
      games_won: 0,
      win_rate: 0,
      total_play_time: 0,
    };
  }
}

export const profileService = new ProfileService();
