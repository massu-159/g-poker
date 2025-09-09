/**
 * User Store (Zustand)
 * Manages user profile, authentication state, and preferences
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Player, PlayerProfile } from '../lib/entities/Player';
import { authService } from '../services/authService';

// User authentication state
export enum AuthStatus {
  UNKNOWN = 'unknown',
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error'
}

// User preferences interface
export interface UserPreferences {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  animationsEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'ja';
  cardAnimationSpeed: 'slow' | 'normal' | 'fast';
  autoPassTimeout: number; // in seconds, 0 = disabled
}

// Game history statistics
export interface GameHistory {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  averageGameDuration: number;
  fastestWin: number;
  longestGame: number;
  favoriteCreatureType?: string;
  recentGames: {
    gameId: string;
    result: 'win' | 'loss';
    duration: number;
    creatureType: string;
    playedAt: string;
  }[];
}

// User store state interface
export interface UserStoreState {
  // Authentication
  authStatus: AuthStatus;
  deviceId: string | null;
  currentPlayer: Player | null;
  session: any | null;
  
  // Profile
  profile: PlayerProfile | null;
  preferences: UserPreferences;
  gameHistory: GameHistory;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  
  // Actions
  authenticateWithDevice: (deviceId: string, gameId: string, displayName?: string) => Promise<void>;
  updateProfile: (updates: Partial<PlayerProfile>) => Promise<void>;
  updatePreferences: (updates: Partial<UserPreferences>) => void;
  signOut: (gameId?: string) => Promise<void>;
  
  // Game history
  addGameResult: (gameResult: {
    gameId: string;
    result: 'win' | 'loss';
    duration: number;
    creatureType: string;
  }) => void;
  
  // Utility
  clearError: () => void;
  reset: () => void;
}

// Default preferences
const defaultPreferences: UserPreferences = {
  soundEnabled: true,
  hapticEnabled: true,
  animationsEnabled: true,
  theme: 'system',
  language: 'en',
  cardAnimationSpeed: 'normal',
  autoPassTimeout: 0 // Disabled by default
};

// Default game history
const defaultGameHistory: GameHistory = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  winRate: 0,
  averageGameDuration: 0,
  fastestWin: 0,
  longestGame: 0,
  recentGames: []
};

// Initial state
const initialState = {
  authStatus: AuthStatus.UNKNOWN,
  deviceId: null,
  currentPlayer: null,
  session: null,
  profile: null,
  preferences: defaultPreferences,
  gameHistory: defaultGameHistory,
  isLoading: false,
  error: null,
};

export const useUserStore = create<UserStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Authenticate with device ID
      authenticateWithDevice: async (deviceId: string, gameId: string, displayName?: string) => {
        try {
          set({ 
            authStatus: AuthStatus.AUTHENTICATING,
            isLoading: true,
            error: null 
          });

          const result = await authService.authenticateWithDeviceId(deviceId, gameId, displayName);
          
          if (result.success && result.data) {
            const { player, session } = result.data;
            
            set({
              authStatus: AuthStatus.AUTHENTICATED,
              deviceId,
              currentPlayer: player,
              session,
              profile: player.profile,
              isLoading: false
            });
          } else {
            set({
              authStatus: AuthStatus.ERROR,
              error: result.error?.message || 'Authentication failed',
              isLoading: false
            });
          }
        } catch (error) {
          set({
            authStatus: AuthStatus.ERROR,
            error: error instanceof Error ? error.message : 'Authentication failed',
            isLoading: false
          });
        }
      },

      // Update user profile
      updateProfile: async (updates: Partial<PlayerProfile>) => {
        const { currentPlayer } = get();
        
        if (!currentPlayer) {
          throw new Error('No authenticated player');
        }

        try {
          set({ isLoading: true, error: null });

          const result = await authService.updateProfile(currentPlayer.id, {
            ...(updates.displayName !== undefined && { displayName: updates.displayName }),
            ...(updates.avatar !== undefined && { avatar: updates.avatar }),
            ...(updates.preferences !== undefined && { preferences: updates.preferences })
          });

          if (result.success && result.data) {
            set({
              currentPlayer: result.data,
              profile: result.data.profile,
              isLoading: false
            });
          } else {
            set({
              error: result.error?.message || 'Failed to update profile',
              isLoading: false
            });
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to update profile',
            isLoading: false
          });
        }
      },

      // Update user preferences (local only)
      updatePreferences: (updates: Partial<UserPreferences>) => {
        set(state => ({
          preferences: {
            ...state.preferences,
            ...updates
          }
        }));
      },

      // Sign out
      signOut: async (gameId?: string) => {
        try {
          set({ isLoading: true });

          if (gameId) {
            const result = await authService.signOut(gameId);
            if (!result.success) {
              console.warn('Sign out failed:', result.error?.message);
            }
          }

          set({
            authStatus: AuthStatus.UNAUTHENTICATED,
            deviceId: null,
            currentPlayer: null,
            session: null,
            profile: null,
            isLoading: false
          });
        } catch (error) {
          console.error('Sign out error:', error);
          // Still clear local state even if remote sign out fails
          set({
            authStatus: AuthStatus.UNAUTHENTICATED,
            deviceId: null,
            currentPlayer: null,
            session: null,
            profile: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Sign out failed'
          });
        }
      },

      // Add game result to history
      addGameResult: (gameResult: {
        gameId: string;
        result: 'win' | 'loss';
        duration: number;
        creatureType: string;
      }) => {
        set(state => {
          const newGameHistory = { ...state.gameHistory };
          
          // Update statistics
          newGameHistory.totalGames += 1;
          
          if (gameResult.result === 'win') {
            newGameHistory.wins += 1;
            
            // Update fastest win
            if (newGameHistory.fastestWin === 0 || gameResult.duration < newGameHistory.fastestWin) {
              newGameHistory.fastestWin = gameResult.duration;
            }
          } else {
            newGameHistory.losses += 1;
          }
          
          // Update win rate
          newGameHistory.winRate = newGameHistory.wins / newGameHistory.totalGames;
          
          // Update average duration
          const totalDuration = state.gameHistory.averageGameDuration * state.gameHistory.totalGames + gameResult.duration;
          newGameHistory.averageGameDuration = totalDuration / newGameHistory.totalGames;
          
          // Update longest game
          if (gameResult.duration > newGameHistory.longestGame) {
            newGameHistory.longestGame = gameResult.duration;
          }
          
          // Add to recent games (keep last 10)
          const recentGame = {
            gameId: gameResult.gameId,
            result: gameResult.result,
            duration: gameResult.duration,
            creatureType: gameResult.creatureType,
            playedAt: new Date().toISOString()
          };
          
          newGameHistory.recentGames = [recentGame, ...state.gameHistory.recentGames].slice(0, 10);
          
          // Update favorite creature type (most played)
          const creatureTypeCounts: Record<string, number> = {};
          newGameHistory.recentGames.forEach(game => {
            creatureTypeCounts[game.creatureType] = (creatureTypeCounts[game.creatureType] || 0) + 1;
          });
          
          const mostPlayedCreature = Object.entries(creatureTypeCounts)
            .sort(([,a], [,b]) => b - a)[0];
          
          if (mostPlayedCreature) {
            newGameHistory.favoriteCreatureType = mostPlayedCreature[0];
          }
          
          return {
            gameHistory: newGameHistory
          };
        });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Reset store (except preferences and game history)
      reset: () => {
        const { preferences, gameHistory } = get();
        set({
          ...initialState,
          preferences,
          gameHistory
        });
      }
    }),
    {
      name: 'gokiburi-user-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist certain fields
      partialize: (state) => ({
        deviceId: state.deviceId,
        preferences: state.preferences,
        gameHistory: state.gameHistory,
        profile: state.profile
      }),
      // Skip hydration of sensitive data
      skipHydration: false,
      // Version for migration support
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // Handle migration between versions
        if (version < 1) {
          // Migration logic for version 1
          return {
            ...persistedState,
            preferences: {
              ...defaultPreferences,
              ...persistedState.preferences
            }
          };
        }
        return persistedState;
      }
    }
  )
);

// Selectors for common state combinations
export const useAuthState = () => useUserStore(state => ({
  authStatus: state.authStatus,
  deviceId: state.deviceId,
  currentPlayer: state.currentPlayer,
  isAuthenticated: state.authStatus === AuthStatus.AUTHENTICATED,
  isLoading: state.isLoading,
  error: state.error
}));

export const useUserProfile = () => useUserStore(state => ({
  profile: state.profile,
  preferences: state.preferences,
  gameHistory: state.gameHistory
}));

export const useUserActions = () => useUserStore(state => ({
  authenticateWithDevice: state.authenticateWithDevice,
  updateProfile: state.updateProfile,
  updatePreferences: state.updatePreferences,
  signOut: state.signOut,
  clearError: state.clearError
}));

export const useGameStats = () => useUserStore(state => ({
  totalGames: state.gameHistory.totalGames,
  wins: state.gameHistory.wins,
  losses: state.gameHistory.losses,
  winRate: state.gameHistory.winRate,
  averageGameDuration: state.gameHistory.averageGameDuration,
  fastestWin: state.gameHistory.fastestWin,
  longestGame: state.gameHistory.longestGame,
  favoriteCreatureType: state.gameHistory.favoriteCreatureType,
  recentGames: state.gameHistory.recentGames,
  addGameResult: state.addGameResult
}));

// Helper hooks for specific preferences
export const useAppPreferences = () => useUserStore(state => ({
  soundEnabled: state.preferences.soundEnabled,
  hapticEnabled: state.preferences.hapticEnabled,
  animationsEnabled: state.preferences.animationsEnabled,
  theme: state.preferences.theme,
  language: state.preferences.language,
  updatePreferences: state.updatePreferences
}));

export const useGamePreferences = () => useUserStore(state => ({
  cardAnimationSpeed: state.preferences.cardAnimationSpeed,
  autoPassTimeout: state.preferences.autoPassTimeout,
  updatePreferences: state.updatePreferences
}));