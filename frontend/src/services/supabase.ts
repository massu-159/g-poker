/**
 * Supabase Service Stub
 * TODO: Migrate tutorial to use useAuth hook
 * This is a temporary stub to unblock compilation
 */

import { apiClient } from './ApiClient';

class AuthManager {
  async updateTutorialProgress(progress: { completed: boolean }): Promise<void> {
    try {
      // Tutorial progress is now stored via profile updates
      await apiClient.updateProfile({
        metadata: { tutorialCompleted: progress.completed },
      } as any);
    } catch (error) {
      console.error('Failed to update tutorial progress:', error);
    }
  }
}

export const authManager = new AuthManager();
