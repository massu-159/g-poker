/**
 * Matchmaking Service
 * Handles player matchmaking, queue management, and game creation
 */

import { gameService } from './gameService';
import { authService } from './authService';
import {
  Game,
  GameSettings,
  validateGameSettings
} from '../lib/entities/Game';
import {
  PlayerAuth
} from '../lib/entities/Player';
import { initializeGame } from '../lib/gameLogic';

// Matchmaking interfaces
export interface MatchmakingRequest {
  playerAuth: PlayerAuth;
  displayName: string;
  gameSettings: GameSettings;
  maxWaitTime?: number; // in milliseconds
}

export interface MatchmakingResult {
  success: boolean;
  data?: {
    matchmakingId: string;
    status: 'searching' | 'matched' | 'timeout' | 'cancelled';
    gameId?: string;
    queuePosition?: number;
    estimatedWaitTime?: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface MatchmakingStatus {
  matchmakingId: string;
  status: 'searching' | 'waiting' | 'matched' | 'timeout' | 'cancelled';
  playersFound: number;
  playersNeeded: number;
  gameId?: string;
  queuePosition: number;
  estimatedWaitTime: number;
  createdAt: string;
  expiresAt?: string;
}

export interface QueueStatistics {
  totalPlayersInQueue: number;
  averageWaitTime: number;
  activeMatches: number;
  queuesBySettings: Record<string, number>;
}

// Internal queue entry
interface QueueEntry {
  matchmakingId: string;
  playerAuth: PlayerAuth;
  displayName: string;
  gameSettings: GameSettings;
  createdAt: Date;
  expiresAt: Date | null;
  status: 'waiting' | 'matched' | 'expired' | 'cancelled';
}

/**
 * MatchmakingService handles finding matches between players
 */
export class MatchmakingService {
  private queue: QueueEntry[] = [];
  private activeMatches: Map<string, string[]> = new Map(); // matchmakingId -> gameId
  private queueCleanupInterval?: NodeJS.Timeout;
  private matchmakingTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    // Start queue maintenance
    this.startQueueMaintenance();
  }

  /**
   * Request matchmaking
   */
  async findMatch(request: MatchmakingRequest): Promise<MatchmakingResult> {
    try {
      // Validate request
      if (!validateGameSettings(request.gameSettings)) {
        return {
          success: false,
          error: {
            code: 'INVALID_GAME_SETTINGS',
            message: 'Invalid game settings provided'
          }
        };
      }

      // Player validation will be done during game creation
      // Skip player lookup during matchmaking phase

      // Check if player is already in queue
      const existingEntry = this.queue.find(entry => 
        entry.playerAuth.deviceId === request.playerAuth.deviceId &&
        entry.status === 'waiting'
      );

      if (existingEntry) {
        return {
          success: false,
          error: {
            code: 'ALREADY_IN_QUEUE',
            message: 'Player is already in matchmaking queue'
          }
        };
      }

      const matchmakingId = `mm_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const now = new Date();
      const expiresAt = request.maxWaitTime ? 
        new Date(now.getTime() + request.maxWaitTime) : 
        null;

      // Create queue entry
      const queueEntry: QueueEntry = {
        matchmakingId,
        playerAuth: request.playerAuth,
        displayName: request.displayName,
        gameSettings: request.gameSettings,
        createdAt: now,
        expiresAt,
        status: 'waiting'
      };

      // Add to queue
      this.queue.push(queueEntry);

      // Set timeout if specified
      if (request.maxWaitTime) {
        const timeout = setTimeout(() => {
          this.handleMatchmakingTimeout(matchmakingId);
        }, request.maxWaitTime);
        
        this.matchmakingTimeouts.set(matchmakingId, timeout);
      }

      // Try to find match immediately
      const matchResult = await this.tryFindMatch(queueEntry);

      if (matchResult.success && matchResult.data?.status === 'matched') {
        return matchResult;
      }

      // Return queued status
      const queuePosition = this.getQueuePosition(matchmakingId);
      const estimatedWaitTime = this.estimateWaitTime(request.gameSettings);

      return {
        success: true,
        data: {
          matchmakingId,
          status: 'searching',
          queuePosition,
          estimatedWaitTime
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MATCHMAKING_EXCEPTION',
          message: error instanceof Error ? error.message : 'Matchmaking failed'
        }
      };
    }
  }

  /**
   * Get matchmaking status
   */
  async getMatchmakingStatus(
    matchmakingId: string,
    playerAuth: PlayerAuth
  ): Promise<{
    success: boolean;
    data?: MatchmakingStatus;
    error?: { code: string; message: string };
  }> {
    try {
      const entry = this.queue.find(e => e.matchmakingId === matchmakingId);
      
      if (!entry) {
        return {
          success: false,
          error: {
            code: 'MATCHMAKING_NOT_FOUND',
            message: 'Matchmaking request not found'
          }
        };
      }

      // Verify player owns this matchmaking request
      if (entry.playerAuth.deviceId !== playerAuth.deviceId) {
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to view this matchmaking status'
          }
        };
      }

      const queuePosition = this.getQueuePosition(matchmakingId);
      const estimatedWaitTime = this.estimateWaitTime(entry.gameSettings);
      
      // Count compatible players
      const compatiblePlayers = this.queue.filter(e => 
        e.status === 'waiting' && 
        this.areSettingsCompatible(e.gameSettings, entry.gameSettings)
      ).length;

      let status: MatchmakingStatus['status'] = 'searching';
      if (entry.status === 'matched') status = 'matched';
      else if (entry.status === 'expired') status = 'timeout';
      else if (entry.status === 'cancelled') status = 'cancelled';
      else if (compatiblePlayers >= 2) status = 'waiting';

      const gameIdArray = this.activeMatches.get(matchmakingId);
      const gameId = gameIdArray ? gameIdArray[0] : undefined;

      const matchmakingStatus: MatchmakingStatus = {
        matchmakingId,
        status,
        playersFound: Math.min(compatiblePlayers, 2),
        playersNeeded: 2,
        queuePosition,
        estimatedWaitTime,
        createdAt: entry.createdAt.toISOString(),
        ...(entry.expiresAt ? { expiresAt: entry.expiresAt.toISOString() } : {}),
        ...(gameId ? { gameId } : {})
      };

      return {
        success: true,
        data: matchmakingStatus
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_STATUS_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to get matchmaking status'
        }
      };
    }
  }

  /**
   * Cancel matchmaking
   */
  async cancelMatchmaking(
    matchmakingId: string,
    playerAuth: PlayerAuth
  ): Promise<{
    success: boolean;
    error?: { code: string; message: string };
  }> {
    try {
      const entryIndex = this.queue.findIndex(e => e.matchmakingId === matchmakingId);
      
      if (entryIndex === -1) {
        return {
          success: false,
          error: {
            code: 'MATCHMAKING_NOT_FOUND',
            message: 'Matchmaking request not found'
          }
        };
      }

      const entry = this.queue[entryIndex];
      if (!entry) {
        return {
          success: false,
          error: {
            code: 'MATCHMAKING_NOT_FOUND',
            message: 'Matchmaking request not found'
          }
        };
      }

      // Verify player owns this request
      if (entry.playerAuth.deviceId !== playerAuth.deviceId) {
        return {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Not authorized to cancel this matchmaking request'
          }
        };
      }

      // Can't cancel if already matched
      if (entry.status === 'matched') {
        return {
          success: false,
          error: {
            code: 'ALREADY_MATCHED',
            message: 'Cannot cancel - already matched to a game'
          }
        };
      }

      // Update status and remove from queue
      entry.status = 'cancelled';
      this.queue.splice(entryIndex, 1);

      // Clear timeout
      const timeout = this.matchmakingTimeouts.get(matchmakingId);
      if (timeout) {
        clearTimeout(timeout);
        this.matchmakingTimeouts.delete(matchmakingId);
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CANCEL_MATCHMAKING_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to cancel matchmaking'
        }
      };
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStatistics(): Promise<{
    success: boolean;
    data?: QueueStatistics;
    error?: { code: string; message: string };
  }> {
    try {
      const activeQueue = this.queue.filter(e => e.status === 'waiting');
      
      // Calculate average wait time from recently completed matches
      const completedMatches = this.queue.filter(e => 
        e.status === 'matched' && 
        e.createdAt.getTime() > Date.now() - 24 * 60 * 60 * 1000 // Last 24 hours
      );

      const averageWaitTime = completedMatches.length > 0 ?
        completedMatches.reduce((sum, entry) => {
          const waitTime = (new Date().getTime() - entry.createdAt.getTime());
          return sum + waitTime;
        }, 0) / completedMatches.length : 0;

      // Group by settings
      const queuesBySettings: Record<string, number> = {};
      activeQueue.forEach(entry => {
        const settingsKey = this.getSettingsKey(entry.gameSettings);
        queuesBySettings[settingsKey] = (queuesBySettings[settingsKey] || 0) + 1;
      });

      const statistics: QueueStatistics = {
        totalPlayersInQueue: activeQueue.length,
        averageWaitTime: Math.round(averageWaitTime / 1000), // Convert to seconds
        activeMatches: this.activeMatches.size,
        queuesBySettings
      };

      return {
        success: true,
        data: statistics
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'GET_STATISTICS_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to get queue statistics'
        }
      };
    }
  }

  /**
   * Try to find a match for a queue entry
   */
  private async tryFindMatch(entry: QueueEntry): Promise<MatchmakingResult> {
    try {
      // Find compatible players in queue
      const compatibleEntries = this.queue.filter(e =>
        e.matchmakingId !== entry.matchmakingId &&
        e.status === 'waiting' &&
        this.areSettingsCompatible(e.gameSettings, entry.gameSettings)
      );

      if (compatibleEntries.length === 0) {
        // No compatible players found
        return {
          success: true,
          data: {
            matchmakingId: entry.matchmakingId,
            status: 'searching',
            queuePosition: this.getQueuePosition(entry.matchmakingId),
            estimatedWaitTime: this.estimateWaitTime(entry.gameSettings)
          }
        };
      }

      // Take the first compatible player (FIFO)
      const matchedEntry = compatibleEntries[0];
      if (!matchedEntry) {
        return {
          success: false,
          error: {
            code: 'NO_COMPATIBLE_PLAYERS',
            message: 'No compatible players found'
          }
        };
      }

      // Initialize game with device IDs
      const gameResult = await this.createMatchedGameWithDeviceIds(
        entry.playerAuth.deviceId,
        entry.displayName,
        matchedEntry.playerAuth.deviceId,
        matchedEntry.displayName,
        entry.gameSettings
      );

      if (!gameResult.success) {
        return {
          success: false,
          error: gameResult.error || { code: 'GAME_CREATION_FAILED', message: 'Failed to create game' }
        };
      }

      const game = gameResult.data!;

      // Update queue entries
      entry.status = 'matched';
      matchedEntry.status = 'matched';

      // Track active matches
      this.activeMatches.set(entry.matchmakingId, [game.id]);
      this.activeMatches.set(matchedEntry.matchmakingId, [game.id]);

      // Clear timeouts
      [entry.matchmakingId, matchedEntry.matchmakingId].forEach(id => {
        const timeout = this.matchmakingTimeouts.get(id);
        if (timeout) {
          clearTimeout(timeout);
          this.matchmakingTimeouts.delete(id);
        }
      });

      // Remove from queue after short delay (for status checks)
      setTimeout(() => {
        this.queue = this.queue.filter(e => 
          e.matchmakingId !== entry.matchmakingId && 
          e.matchmakingId !== matchedEntry.matchmakingId
        );
      }, 5000);

      return {
        success: true,
        data: {
          matchmakingId: entry.matchmakingId,
          status: 'matched',
          gameId: game.id
        }
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'MATCH_CREATION_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to create match'
        }
      };
    }
  }

  /**
   * Create a game for matched players using device IDs
   */
  private async createMatchedGameWithDeviceIds(
    deviceId1: string,
    displayName1: string,
    deviceId2: string,
    displayName2: string,
    gameSettings: GameSettings
  ): Promise<{ success: boolean; data?: Game; error?: { code: string; message: string } }> {
    try {
      // Create game
      const createGameResult = await gameService.createGame({
        settings: gameSettings,
        createdBy: deviceId1 // Use device ID as temporary creator ID
      });

      if (!createGameResult.success) {
        return { success: false, error: createGameResult.error || { code: 'CREATE_GAME_FAILED', message: 'Failed to create game' } };
      }

      const game = createGameResult.data!;

      // Authenticate and join first player
      const authResult1 = await authService.authenticateWithDeviceId(deviceId1, game.id, displayName1);
      if (!authResult1.success) {
        return { success: false, error: authResult1.error || { code: 'PLAYER1_AUTH_FAILED', message: 'Failed to authenticate player 1' } };
      }

      // Authenticate and join second player
      const authResult2 = await authService.authenticateWithDeviceId(deviceId2, game.id, displayName2);
      if (!authResult2.success) {
        return { success: false, error: authResult2.error || { code: 'PLAYER2_AUTH_FAILED', message: 'Failed to authenticate player 2' } };
      }

      // Initialize game with players and deal cards
      const player1 = authResult1.data!.player;
      const player2 = authResult2.data!.player;
      const initResult = initializeGame(game.id, player1, player2, gameSettings);
      
      if (!initResult.success) {
        return {
          success: false,
          error: {
            code: 'GAME_INIT_ERROR',
            message: initResult.error?.message || 'Failed to initialize game'
          }
        };
      }

      // Start the game
      const startResult = await gameService.startGame(game.id);
      if (!startResult.success) {
        return startResult;
      }

      return {
        success: true,
        ...(startResult.data ? { data: startResult.data } : {})
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CREATE_GAME_EXCEPTION',
          message: error instanceof Error ? error.message : 'Failed to create matched game'
        }
      };
    }
  }

  /**
   * Check if two game settings are compatible for matching
   */
  private areSettingsCompatible(settings1: GameSettings, settings2: GameSettings): boolean {
    return (
      settings1.winCondition === settings2.winCondition &&
      Math.abs(settings1.turnTimeLimit - settings2.turnTimeLimit) <= 30 // Allow 30 second difference
    );
  }

  /**
   * Get settings key for grouping
   */
  private getSettingsKey(settings: GameSettings): string {
    return `${settings.winCondition}_${Math.round(settings.turnTimeLimit / 30) * 30}`;
  }

  /**
   * Get queue position for a matchmaking request
   */
  private getQueuePosition(matchmakingId: string): number {
    const index = this.queue.findIndex(e => e.matchmakingId === matchmakingId);
    return index >= 0 ? index + 1 : 0;
  }

  /**
   * Estimate wait time based on queue state and settings
   */
  private estimateWaitTime(gameSettings: GameSettings): number {
    const compatiblePlayers = this.queue.filter(e =>
      e.status === 'waiting' &&
      this.areSettingsCompatible(e.gameSettings, gameSettings)
    ).length;

    if (compatiblePlayers >= 2) {
      return 5000; // 5 seconds for immediate match
    }

    // Base wait time + factor based on queue depth
    const baseWaitTime = 30000; // 30 seconds
    const queueFactor = Math.max(0, (10 - compatiblePlayers) * 5000); // Additional 5s per missing player
    
    return baseWaitTime + queueFactor;
  }

  /**
   * Handle matchmaking timeout
   */
  private handleMatchmakingTimeout(matchmakingId: string) {
    const entry = this.queue.find(e => e.matchmakingId === matchmakingId);
    if (entry && entry.status === 'waiting') {
      entry.status = 'expired';
      
      // Remove from queue after grace period
      setTimeout(() => {
        this.queue = this.queue.filter(e => e.matchmakingId !== matchmakingId);
      }, 10000);
    }

    this.matchmakingTimeouts.delete(matchmakingId);
  }

  /**
   * Start queue maintenance (cleanup expired entries)
   */
  private startQueueMaintenance() {
    this.queueCleanupInterval = setInterval(() => {
      this.cleanupQueue();
    }, 60000); // Every minute
  }

  /**
   * Cleanup expired queue entries
   */
  private cleanupQueue() {
    const now = new Date();
    const expiredEntries: string[] = [];

    this.queue = this.queue.filter(entry => {
      if (entry.expiresAt && entry.expiresAt < now && entry.status === 'waiting') {
        entry.status = 'expired';
        expiredEntries.push(entry.matchmakingId);
        return false;
      }
      
      // Remove old completed entries
      if (entry.status !== 'waiting' && entry.createdAt.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
        return false;
      }
      
      return true;
    });

    // Clear timeouts for expired entries
    expiredEntries.forEach(id => {
      const timeout = this.matchmakingTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        this.matchmakingTimeouts.delete(id);
      }
    });
  }

  /**
   * Shutdown matchmaking service
   */
  shutdown() {
    if (this.queueCleanupInterval) {
      clearInterval(this.queueCleanupInterval);
    }

    // Clear all timeouts
    this.matchmakingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.matchmakingTimeouts.clear();
  }
}

// Export singleton instance
export const matchmakingService = new MatchmakingService();