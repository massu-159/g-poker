/**
 * T015-T016: Contract test - Player and matchmaking operations
 * Tests player join game, matchmaking, and connection management
 * MUST FAIL before implementation exists
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('Player Operations Contract', () => {
  let playerService: any;
  let matchmakingService: any;
  let testGameId: string;
  let testPlayerId: string;
  let authPlayer: any;

  beforeAll(async () => {
    // This will fail until we implement these services
    const { PlayerService } = await import('../../../src/services/playerService');
    const { MatchmakingService } = await import('../../../src/services/matchmakingService');
    const { AuthService } = await import('../../../src/services/authService');
    
    playerService = new PlayerService();
    matchmakingService = new MatchmakingService();
    authPlayer = await AuthService.authenticateWithDeviceId('test-player-789');
    
    // Create test game
    const { GameService } = await import('../../../src/services/gameService');
    const gameService = new GameService();
    const game = await gameService.createGame({}, authPlayer);
    testGameId = game.data.id;
  });

  afterAll(async () => {
    // Cleanup test data
    if (testPlayerId) {
      await playerService.removePlayer(testPlayerId);
    }
  });

  test('should allow player to join game', async () => {
    const playerData = {
      gameId: testGameId,
      displayName: 'TestPlayer1',
      deviceId: authPlayer.deviceId
    };

    const result = await playerService.joinGame(playerData, authPlayer);
    
    expect(result.success).toBe(true);
    expect(result.data.id).toBeDefined();
    expect(result.data.gameId).toBe(testGameId);
    expect(result.data.displayName).toBe('TestPlayer1');
    expect(result.data.isConnected).toBe(true);
    
    testPlayerId = result.data.id;
  });

  test('should enforce player name validation', async () => {
    const invalidPlayerData = {
      gameId: testGameId,
      displayName: '', // Invalid: too short
      deviceId: 'test-device-invalid'
    };

    const result = await playerService.joinGame(invalidPlayerData, authPlayer);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should find available game for matchmaking', async () => {
    const matchmakingRequest = {
      playerCount: 2,
      gameSettings: {
        winCondition: 3,
        turnTimeLimit: 60
      }
    };

    const result = await matchmakingService.findGame(matchmakingRequest, authPlayer);
    
    expect(result.success).toBe(true);
    expect(result.data.gameId).toBeDefined();
    expect(result.data.status).toBe('waiting_for_players');
  });

  test('should track matchmaking status', async () => {
    const matchRequest = await matchmakingService.findGame({
      playerCount: 2
    }, authPlayer);
    
    if (!matchRequest.success) {
      throw new Error('Matchmaking request failed');
    }

    const statusResult = await matchmakingService.getMatchmakingStatus(
      matchRequest.data.matchId,
      authPlayer
    );
    
    expect(statusResult.success).toBe(true);
    expect(statusResult.data.status).toMatch(/waiting|matched|timeout/);
    expect(statusResult.data.playersFound).toBeGreaterThanOrEqual(0);
  });

  test('should update player connection status', async () => {
    if (!testPlayerId) {
      throw new Error('Test player not created');
    }

    const result = await playerService.updateConnectionStatus(
      testPlayerId,
      false,
      authPlayer
    );
    
    expect(result.success).toBe(true);
    expect(result.data.isConnected).toBe(false);
    expect(result.data.lastSeen).toBeDefined();
  });

  test('should prevent unauthorized player updates', async () => {
    if (!testPlayerId) {
      throw new Error('Test player not created');
    }

    const unauthorizedAuth = { deviceId: 'unauthorized-device' };
    const result = await playerService.updateConnectionStatus(
      testPlayerId,
      true,
      unauthorizedAuth
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});