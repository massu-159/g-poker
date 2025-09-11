/**
 * Offline Storage Service with SQLite
 * Local database for caching game data and offline functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { Game } from '../lib/entities/Game';
import { Player } from '../lib/entities/Player';
import { Card } from '../lib/entities/Card';
import { Round } from '../lib/entities/Round';

// Storage keys
const STORAGE_KEYS = {
  GAME_CACHE: 'game_cache',
  PLAYER_PROFILE: 'player_profile',
  GAME_HISTORY: 'game_history',
  OFFLINE_ACTIONS: 'offline_actions',
  USER_PREFERENCES: 'user_preferences',
  CARD_CACHE: 'card_cache',
  LAST_SYNC: 'last_sync',
} as const;

// Storage interfaces
export interface CachedGame {
  game: Game;
  lastUpdated: number;
  isOffline: boolean;
}

export interface CachedPlayer {
  player: Player;
  lastUpdated: number;
}

export interface OfflineAction {
  id: string;
  type: 'play_card' | 'join_game' | 'leave_game' | 'respond_to_card' | 'error_report' | 'bug_report';
  payload: any;
  timestamp: number;
  gameId: string;
  playerId: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  soundEnabled: boolean;
  animationSpeed: 'slow' | 'normal' | 'fast';
  language: 'ja' | 'en';
  autoReconnect: boolean;
  cardSize: 'small' | 'normal' | 'large';
}

export interface GameHistoryEntry {
  gameId: string;
  result: 'win' | 'loss' | 'abandoned';
  duration: number;
  finalScore: number;
  opponentName: string;
  timestamp: number;
}

// Default preferences
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'auto',
  soundEnabled: true,
  animationSpeed: 'normal',
  language: 'ja',
  autoReconnect: true,
  cardSize: 'normal',
};

/**
 * Storage Service Class
 * Manages local SQLite database and AsyncStorage for offline functionality
 */
class StorageService {
  private isInitialized = false;
  private cacheSize = {
    games: 0,
    players: 0,
    actions: 0,
  };

  /**
   * Initialize the storage service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // For React Native, we'd typically use react-native-sqlite-storage
      // For now, we'll use AsyncStorage as a fallback
      await this.setupDatabase();
      await this.cleanupOldData();
      this.isInitialized = true;
      
      console.log('[Storage] Service initialized successfully');
    } catch (error) {
      console.error('[Storage] Failed to initialize:', error);
      throw error;
    }
  }

  // Game Data Management

  /**
   * Cache a game for offline access
   */
  async cacheGame(game: Game, isOffline = false): Promise<void> {
    const cached: CachedGame = {
      game,
      lastUpdated: Date.now(),
      isOffline,
    };

    const key = `${STORAGE_KEYS.GAME_CACHE}_${game.id}`;
    await AsyncStorage.setItem(key, JSON.stringify(cached));
    this.cacheSize.games++;
  }

  /**
   * Retrieve a cached game
   */
  async getCachedGame(gameId: string): Promise<CachedGame | null> {
    try {
      const key = `${STORAGE_KEYS.GAME_CACHE}_${gameId}`;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) return null;
      
      const cached: CachedGame = JSON.parse(data);
      
      // Check if cache is still valid (24 hours)
      const maxAge = 24 * 60 * 60 * 1000;
      if (Date.now() - cached.lastUpdated > maxAge) {
        await this.removeCachedGame(gameId);
        return null;
      }
      
      return cached;
    } catch (error) {
      console.error('[Storage] Failed to get cached game:', error);
      return null;
    }
  }

  /**
   * Remove a cached game
   */
  async removeCachedGame(gameId: string): Promise<void> {
    const key = `${STORAGE_KEYS.GAME_CACHE}_${gameId}`;
    await AsyncStorage.removeItem(key);
    this.cacheSize.games = Math.max(0, this.cacheSize.games - 1);
  }

  /**
   * Get all cached games
   */
  async getAllCachedGames(): Promise<CachedGame[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const gameKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.GAME_CACHE));
      
      const games: CachedGame[] = [];
      
      for (const key of gameKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          games.push(JSON.parse(data));
        }
      }
      
      return games.sort((a, b) => b.lastUpdated - a.lastUpdated);
    } catch (error) {
      console.error('[Storage] Failed to get all cached games:', error);
      return [];
    }
  }

  // Player Data Management

  /**
   * Cache player profile
   */
  async cachePlayer(player: Player): Promise<void> {
    const cached: CachedPlayer = {
      player,
      lastUpdated: Date.now(),
    };

    await AsyncStorage.setItem(STORAGE_KEYS.PLAYER_PROFILE, JSON.stringify(cached));
  }

  /**
   * Get cached player profile
   */
  async getCachedPlayer(): Promise<Player | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PLAYER_PROFILE);
      
      if (!data) return null;
      
      const cached: CachedPlayer = JSON.parse(data);
      return cached.player;
    } catch (error) {
      console.error('[Storage] Failed to get cached player:', error);
      return null;
    }
  }

  // Offline Actions Management

  /**
   * Store an offline action to be synced later
   */
  async storeOfflineAction(action: Omit<OfflineAction, 'id' | 'timestamp'>): Promise<void> {
    const offlineAction: OfflineAction = {
      ...action,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    const existingActions = await this.getOfflineActions();
    existingActions.push(offlineAction);

    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_ACTIONS, JSON.stringify(existingActions));
    this.cacheSize.actions++;
  }

  /**
   * Get all pending offline actions
   */
  async getOfflineActions(): Promise<OfflineAction[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_ACTIONS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[Storage] Failed to get offline actions:', error);
      return [];
    }
  }

  /**
   * Remove synced offline actions
   */
  async removeOfflineActions(actionIds: string[]): Promise<void> {
    const existingActions = await this.getOfflineActions();
    const remainingActions = existingActions.filter(action => !actionIds.includes(action.id));
    
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_ACTIONS, JSON.stringify(remainingActions));
    this.cacheSize.actions = remainingActions.length;
  }

  /**
   * Clear all offline actions
   */
  async clearOfflineActions(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_ACTIONS);
    this.cacheSize.actions = 0;
  }

  // User Preferences

  /**
   * Save user preferences
   */
  async savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    const currentPreferences = await this.getPreferences();
    const updatedPreferences = { ...currentPreferences, ...preferences };
    
    await AsyncStorage.setItem(STORAGE_KEYS.USER_PREFERENCES, JSON.stringify(updatedPreferences));
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<UserPreferences> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PREFERENCES);
      
      if (!data) return DEFAULT_PREFERENCES;
      
      const saved = JSON.parse(data);
      return { ...DEFAULT_PREFERENCES, ...saved };
    } catch (error) {
      console.error('[Storage] Failed to get preferences:', error);
      return DEFAULT_PREFERENCES;
    }
  }

  // Game History

  /**
   * Add game to history
   */
  async addToGameHistory(entry: GameHistoryEntry): Promise<void> {
    const history = await this.getGameHistory();
    history.unshift(entry); // Add to beginning
    
    // Keep only last 100 games
    const trimmedHistory = history.slice(0, 100);
    
    await AsyncStorage.setItem(STORAGE_KEYS.GAME_HISTORY, JSON.stringify(trimmedHistory));
  }

  /**
   * Get game history
   */
  async getGameHistory(): Promise<GameHistoryEntry[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.GAME_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[Storage] Failed to get game history:', error);
      return [];
    }
  }

  /**
   * Clear game history
   */
  async clearGameHistory(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.GAME_HISTORY);
  }

  // Sync Management

  /**
   * Update last sync timestamp
   */
  async updateLastSync(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
  }

  /**
   * Get last sync timestamp
   */
  async getLastSync(): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return data ? parseInt(data, 10) : 0;
    } catch (error) {
      console.error('[Storage] Failed to get last sync:', error);
      return 0;
    }
  }

  /**
   * Check if data needs sync (offline actions pending or stale cache)
   */
  async needsSync(): Promise<boolean> {
    const offlineActions = await this.getOfflineActions();
    const lastSync = await this.getLastSync();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    
    return offlineActions.length > 0 || (Date.now() - lastSync > staleThreshold);
  }

  // Database Management

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalSize: number;
    cachedGames: number;
    offlineActions: number;
    historyEntries: number;
    lastSync: number;
  }> {
    const keys = await AsyncStorage.getAllKeys();
    const history = await this.getGameHistory();
    const actions = await this.getOfflineActions();
    const lastSync = await this.getLastSync();
    
    // Estimate total size (approximate)
    let totalSize = 0;
    for (const key of keys) {
      const data = await AsyncStorage.getItem(key);
      totalSize += data ? data.length : 0;
    }

    return {
      totalSize,
      cachedGames: this.cacheSize.games,
      offlineActions: actions.length,
      historyEntries: history.length,
      lastSync,
    };
  }

  /**
   * Clear all cached data
   */
  async clearAllCache(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => 
      key.startsWith(STORAGE_KEYS.GAME_CACHE) ||
      key === STORAGE_KEYS.CARD_CACHE
    );
    
    await AsyncStorage.multiRemove(cacheKeys);
    this.cacheSize = { games: 0, players: 0, actions: this.cacheSize.actions };
  }

  /**
   * Export data for backup
   */
  async exportData(): Promise<{
    preferences: UserPreferences;
    gameHistory: GameHistoryEntry[];
    playerProfile: Player | null;
    timestamp: number;
  }> {
    return {
      preferences: await this.getPreferences(),
      gameHistory: await this.getGameHistory(),
      playerProfile: await this.getCachedPlayer(),
      timestamp: Date.now(),
    };
  }

  /**
   * Import data from backup
   */
  async importData(data: {
    preferences?: UserPreferences;
    gameHistory?: GameHistoryEntry[];
    playerProfile?: Player;
  }): Promise<void> {
    if (data.preferences) {
      await this.savePreferences(data.preferences);
    }
    
    if (data.gameHistory) {
      await AsyncStorage.setItem(STORAGE_KEYS.GAME_HISTORY, JSON.stringify(data.gameHistory));
    }
    
    if (data.playerProfile) {
      await this.cachePlayer(data.playerProfile);
    }
  }

  // Private methods

  private async setupDatabase(): Promise<void> {
    // In a real React Native app, you would initialize SQLite here
    // For now, we're using AsyncStorage
    console.log('[Storage] Database setup complete');
  }

  private async cleanupOldData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const gameKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.GAME_CACHE));
      
      // Remove games older than 7 days
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      const keysToRemove: string[] = [];
      
      for (const key of gameKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const cached: CachedGame = JSON.parse(data);
          if (Date.now() - cached.lastUpdated > maxAge) {
            keysToRemove.push(key);
          }
        }
      }
      
      if (keysToRemove.length > 0) {
        await AsyncStorage.multiRemove(keysToRemove);
        console.log(`[Storage] Cleaned up ${keysToRemove.length} old cache entries`);
      }
    } catch (error) {
      console.error('[Storage] Failed to cleanup old data:', error);
    }
  }
}

// Singleton instance
export const storageService = new StorageService();

// React hook for storage service
export const useStorage = () => {
  return {
    // Game management
    cacheGame: storageService.cacheGame.bind(storageService),
    getCachedGame: storageService.getCachedGame.bind(storageService),
    getAllCachedGames: storageService.getAllCachedGames.bind(storageService),
    
    // Player management
    cachePlayer: storageService.cachePlayer.bind(storageService),
    getCachedPlayer: storageService.getCachedPlayer.bind(storageService),
    
    // Offline actions
    storeOfflineAction: storageService.storeOfflineAction.bind(storageService),
    getOfflineActions: storageService.getOfflineActions.bind(storageService),
    removeOfflineActions: storageService.removeOfflineActions.bind(storageService),
    
    // Preferences
    savePreferences: storageService.savePreferences.bind(storageService),
    getPreferences: storageService.getPreferences.bind(storageService),
    
    // Game history
    addToGameHistory: storageService.addToGameHistory.bind(storageService),
    getGameHistory: storageService.getGameHistory.bind(storageService),
    
    // Utilities
    needsSync: storageService.needsSync.bind(storageService),
    getStorageStats: storageService.getStorageStats.bind(storageService),
    clearAllCache: storageService.clearAllCache.bind(storageService),
    exportData: storageService.exportData.bind(storageService),
    importData: storageService.importData.bind(storageService),
  };
};

export default storageService;