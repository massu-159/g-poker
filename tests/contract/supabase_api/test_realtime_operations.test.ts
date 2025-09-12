/**
 * T017-T021: Contract test - Realtime and game action operations
 * Tests Supabase realtime subscriptions, game actions, and event handling
 * MUST FAIL before implementation exists
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('Realtime Operations Contract', () => {
  let realtimeService: any;
  let gameService: any;
  let testGameId: string;
  let testPlayerId: string;
  let authPlayer: any;
  let realtimeSubscription: any;

  beforeAll(async () => {
    // This will fail until we implement these services
    const { RealtimeService } = await import('../../../src/services/realtimeService');
    const { GameService } = await import('../../../src/services/gameService');
    const { AuthService } = await import('../../../src/services/authService');
    
    realtimeService = new RealtimeService();
    gameService = new GameService();
    authPlayer = await AuthService.authenticateWithDeviceId('test-realtime-player');
    
    // Setup test game and player
    const game = await gameService.createGame({}, authPlayer);
    testGameId = game.data.id;
  });

  afterAll(async () => {
    // Cleanup subscriptions and test data
    if (realtimeSubscription) {
      await realtimeService.unsubscribe(realtimeSubscription);
    }
  });

  test('should establish realtime subscription to game channel', async () => {
    const subscriptionResult = await realtimeService.subscribeToGame(
      testGameId,
      authPlayer,
      {
        onGameStateChange: (payload: any) => {
          expect(payload.table).toBe('games');
          expect(payload.new.id).toBe(testGameId);
        },
        onPlayerJoin: (payload: any) => {
          expect(payload.table).toBe('players');
        },
        onGameAction: (payload: any) => {
          expect(payload.table).toBe('game_actions');
        }
      }
    );
    
    expect(subscriptionResult.success).toBe(true);
    expect(subscriptionResult.data.channel).toBeDefined();
    expect(subscriptionResult.data.status).toBe('subscribed');
    
    realtimeSubscription = subscriptionResult.data;
  });

  test('should receive realtime updates on game state changes', async () => {
    let receivedUpdate = false;
    
    const subscription = await realtimeService.subscribeToGame(
      testGameId,
      authPlayer,
      {
        onGameStateChange: (payload: any) => {
          receivedUpdate = true;
          expect(payload.new.status).toBe('in_progress');
        }
      }
    );

    // Trigger game state change
    await gameService.updateGameStatus(testGameId, 'in_progress', authPlayer);
    
    // Wait for realtime event (with timeout)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    expect(receivedUpdate).toBe(true);
    await realtimeService.unsubscribe(subscription.data);
  });

  test('should record game actions in database', async () => {
    const actionData = {
      gameId: testGameId,
      playerId: testPlayerId,
      actionType: 'join_game',
      actionData: { displayName: 'TestPlayer' }
    };

    const result = await realtimeService.recordGameAction(actionData, authPlayer);
    
    expect(result.success).toBe(true);
    expect(result.data.id).toBeDefined();
    expect(result.data.actionType).toBe('join_game');
    expect(result.data.createdAt).toBeDefined();
  });

  test('should retrieve game action history', async () => {
    // First record some actions
    await realtimeService.recordGameAction({
      gameId: testGameId,
      playerId: testPlayerId,
      actionType: 'join_game',
      actionData: {}
    }, authPlayer);

    const result = await realtimeService.getGameHistory(testGameId, authPlayer);
    
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].actionType).toBeDefined();
  });

  test('should handle realtime connection errors gracefully', async () => {
    // Test with invalid game ID
    const invalidGameId = 'invalid-game-id-123';
    
    const result = await realtimeService.subscribeToGame(
      invalidGameId,
      authPlayer,
      {
        onError: (error: any) => {
          expect(error).toBeDefined();
        }
      }
    );
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should enforce realtime access permissions', async () => {
    const unauthorizedAuth = { deviceId: 'unauthorized-realtime-device' };
    
    const result = await realtimeService.subscribeToGame(
      testGameId,
      unauthorizedAuth,
      {}
    );
    
    // Should fail due to RLS policy
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  test('should validate game action types', async () => {
    const invalidActionData = {
      gameId: testGameId,
      playerId: testPlayerId,
      actionType: 'invalid_action_type', // Should violate CHECK constraint
      actionData: {}
    };

    const result = await realtimeService.recordGameAction(invalidActionData, authPlayer);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});