/**
 * Game Service
 * Integrates ApiClient (REST) and SocketClient (WebSocket) for game operations
 *
 * Server-Authoritative Architecture:
 * - REST API for state queries and non-realtime actions
 * - Socket.io for realtime game events and actions
 */

import { apiClient } from './ApiClient';
import { socketClient } from './SocketClient';

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Game Service Class
 * Combines REST API calls and Socket.io events for complete game functionality
 */
class GameService {
  /**
   * Get game details with participants and join the Socket.io room
   * Combines REST API (for initial state) + Socket.io (for realtime updates)
   */
  async getGameWithParticipants(gameId: string): Promise<ServiceResponse> {
    try {
      console.log('[GameService] Getting game with participants:', gameId);

      // Fetch game details via REST API
      const response = await apiClient.getRoom(gameId);

      if (response.success && response.data) {
        // Join Socket.io room for realtime updates
        if (socketClient.isConnected() && socketClient.isAuth()) {
          socketClient.joinRoom(gameId);
          console.log('[GameService] Joined Socket.io room:', gameId);
        } else {
          console.warn('[GameService] Socket not authenticated, skipping room join');
        }

        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to get game details',
      };
    } catch (error: any) {
      console.error('[GameService] getGameWithParticipants error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get game details',
      };
    }
  }

  /**
   * Join a game room
   * Uses REST API to register participation
   */
  async joinGame(params: { gameId: string; playerId?: string }): Promise<ServiceResponse> {
    try {
      console.log('[GameService] Joining game:', params.gameId);

      const response = await apiClient.joinRoom(params.gameId);

      if (response.success && response.data) {
        console.log('[GameService] Successfully joined game:', response.data);
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to join game',
      };
    } catch (error: any) {
      console.error('[GameService] joinGame error:', error);
      return {
        success: false,
        error: error.message || 'Failed to join game',
      };
    }
  }

  /**
   * Leave a game room
   * Combines REST API (to unregister) + Socket.io (to leave room)
   */
  async leaveGame(gameId: string): Promise<ServiceResponse> {
    try {
      console.log('[GameService] Leaving game:', gameId);

      // Leave via REST API
      const response = await apiClient.leaveRoom(gameId);

      // Leave Socket.io room
      if (socketClient.isConnected()) {
        socketClient.leaveRoom(gameId);
        console.log('[GameService] Left Socket.io room:', gameId);
      }

      if (response.success) {
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to leave game',
      };
    } catch (error: any) {
      console.error('[GameService] leaveGame error:', error);
      return {
        success: false,
        error: error.message || 'Failed to leave game',
      };
    }
  }

  /**
   * Start a game (creator only)
   * Uses REST API to initiate game start
   */
  async startGame(gameId: string): Promise<ServiceResponse> {
    try {
      console.log('[GameService] Starting game:', gameId);

      const response = await apiClient.startGame(gameId);

      if (response.success && response.data) {
        console.log('[GameService] Game started successfully:', response.data);
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to start game',
      };
    } catch (error: any) {
      console.error('[GameService] startGame error:', error);
      return {
        success: false,
        error: error.message || 'Failed to start game',
      };
    }
  }

  /**
   * Make a card claim during gameplay
   * Uses REST API for server validation
   */
  async makeCardClaim(
    gameId: string,
    cardId: string,
    claimedCreature: 'cockroach' | 'mouse' | 'bat' | 'frog',
    targetParticipantId: string
  ): Promise<ServiceResponse> {
    try {
      console.log('[GameService] Making card claim:', {
        gameId,
        cardId,
        claimedCreature,
        targetParticipantId,
      });

      const response = await apiClient.claimCard(gameId, {
        cardId,
        claimedCreature,
        targetPlayerId: targetParticipantId,
      });

      if (response.success && response.data) {
        console.log('[GameService] Card claim successful:', response.data);
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to claim card',
      };
    } catch (error: any) {
      console.error('[GameService] makeCardClaim error:', error);
      return {
        success: false,
        error: error.message || 'Failed to claim card',
      };
    }
  }

  /**
   * Respond to a card claim (believe or doubt)
   * Uses REST API for server validation
   *
   * @param response - 'truth' (believe claim) or 'lie' (doubt claim)
   */
  async respondToCardClaim(
    gameId: string,
    roundId: string,
    response: 'truth' | 'lie' | 'pass_back'
  ): Promise<ServiceResponse> {
    try {
      console.log('[GameService] Responding to card claim:', { gameId, roundId, response });

      // Convert response format to boolean (truth = believe, lie = doubt)
      const believeClaim = response === 'truth';

      const apiResponse = await apiClient.respondToClaim(gameId, {
        roundId,
        believeClaim,
      });

      if (apiResponse.success && apiResponse.data) {
        console.log('[GameService] Claim response successful:', apiResponse.data);
        return {
          success: true,
          data: apiResponse.data,
        };
      }

      return {
        success: false,
        error: apiResponse.error || 'Failed to respond to claim',
      };
    } catch (error: any) {
      console.error('[GameService] respondToCardClaim error:', error);
      return {
        success: false,
        error: error.message || 'Failed to respond to claim',
      };
    }
  }

  /**
   * Pass a card to the next player
   * Uses REST API for server validation
   */
  async passCard(
    gameId: string,
    roundId: string,
    targetPlayerId: string,
    newClaim: 'cockroach' | 'mouse' | 'bat' | 'frog'
  ): Promise<ServiceResponse> {
    try {
      console.log('[GameService] Passing card:', {
        gameId,
        roundId,
        targetPlayerId,
        newClaim,
      });

      const response = await apiClient.passCard(gameId, {
        roundId,
        targetPlayerId,
        newClaim,
      });

      if (response.success && response.data) {
        console.log('[GameService] Pass card successful:', response.data);
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to pass card',
      };
    } catch (error: any) {
      console.error('[GameService] passCard error:', error);
      return {
        success: false,
        error: error.message || 'Failed to pass card',
      };
    }
  }

  /**
   * Get current game state
   * Uses REST API for state query
   */
  async getGameState(gameId: string): Promise<ServiceResponse> {
    try {
      console.log('[GameService] Getting game state:', gameId);

      const response = await apiClient.getGameState(gameId);

      if (response.success && response.data) {
        return {
          success: true,
          data: response.data,
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to get game state',
      };
    } catch (error: any) {
      console.error('[GameService] getGameState error:', error);
      return {
        success: false,
        error: error.message || 'Failed to get game state',
      };
    }
  }
}

export const gameService = new GameService();
