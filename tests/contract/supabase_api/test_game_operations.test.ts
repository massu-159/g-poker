/**
 * T013-T014: Contract test - Game CRUD operations
 * Tests game creation, retrieval, and status management
 * MUST FAIL before implementation exists
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('Game Operations Contract', () => {
  let gameService: any;
  let testGameId: string;
  let authPlayer: any;

  beforeAll(async () => {
    // This will fail until we implement the game service
    const { GameService } = await import('../../../src/services/gameService');
    const { AuthService } = await import('../../../src/services/authService');
    
    gameService = new GameService();
    authPlayer = await AuthService.authenticateWithDeviceId('test-device-123');
  });

  afterAll(async () => {
    // Cleanup test data
    if (testGameId) {
      await gameService.deleteGame(testGameId);
    }
  });

  test('should create new game with valid settings', async () => {
    const gameData = {
      settings: {
        winCondition: 3,
        turnTimeLimit: 60,
        reconnectionGracePeriod: 30
      }
    };

    const result = await gameService.createGame(gameData, authPlayer);
    
    expect(result.success).toBe(true);
    expect(result.data.id).toBeDefined();
    expect(result.data.status).toBe('waiting_for_players');
    expect(result.data.settings).toEqual(gameData.settings);
    
    testGameId = result.data.id;
  });

  test('should retrieve game by ID', async () => {
    if (!testGameId) {
      throw new Error('Test game not created');
    }

    const result = await gameService.getGameById(testGameId, authPlayer);
    
    expect(result.success).toBe(true);
    expect(result.data.id).toBe(testGameId);
    expect(result.data.status).toBe('waiting_for_players');
  });

  test('should enforce game access permissions', async () => {
    if (!testGameId) {
      throw new Error('Test game not created');
    }

    // Try to access game with different player
    const otherAuth = { deviceId: 'other-device-456' };
    const result = await gameService.getGameById(testGameId, otherAuth);
    
    // Should fail due to RLS policy
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should update game status correctly', async () => {
    if (!testGameId) {
      throw new Error('Test game not created');
    }

    const result = await gameService.updateGameStatus(testGameId, 'in_progress', authPlayer);
    
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('in_progress');
    expect(result.data.started_at).toBeDefined();
  });

  test('should validate game status transitions', async () => {
    if (!testGameId) {
      throw new Error('Test game not created');
    }

    // Try invalid status transition
    const result = await gameService.updateGameStatus(testGameId, 'invalid_status', authPlayer);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});