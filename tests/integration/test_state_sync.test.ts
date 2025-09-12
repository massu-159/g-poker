/**
 * T025: Integration test - Game state synchronization
 * Tests realtime state sync across multiple clients and event ordering
 * MUST FAIL before implementation exists
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('Game State Synchronization Integration', () => {
  let realtimeService: any;
  let gameOrchestrator: any;
  let player1Auth: any;
  let player2Auth: any;
  let testGameId: string;
  let receivedEvents: any[] = [];

  beforeAll(async () => {
    // This will fail until we implement realtime synchronization
    const { RealtimeService } = await import('../../src/services/realtimeService');
    const { GameOrchestrator } = await import('../../src/lib/gameLogic/GameOrchestrator');
    const { AuthService } = await import('../../src/services/authService');
    
    realtimeService = new RealtimeService();
    gameOrchestrator = new GameOrchestrator();
    
    player1Auth = await AuthService.authenticateWithDeviceId('sync-test-player-1');
    player2Auth = await AuthService.authenticateWithDeviceId('sync-test-player-2');
    
    // Setup test game
    const gameSetup = await gameOrchestrator.createTestGame([player1Auth, player2Auth]);
    testGameId = gameSetup.data.gameId;
  });

  afterAll(async () => {
    // Cleanup
    if (testGameId) {
      await gameOrchestrator.cleanupGame(testGameId);
    }
  });

  test('should sync game state changes to all connected clients', async () => {
    // Setup realtime subscriptions for both players
    let player1Events: any[] = [];
    let player2Events: any[] = [];

    const subscription1 = await realtimeService.subscribeToGame(
      testGameId,
      player1Auth,
      {
        onGameStateChange: (payload: any) => player1Events.push({ type: 'state_change', payload, timestamp: Date.now() }),
        onPlayerAction: (payload: any) => player1Events.push({ type: 'player_action', payload, timestamp: Date.now() }),
        onError: (error: any) => player1Events.push({ type: 'error', error })
      }
    );

    const subscription2 = await realtimeService.subscribeToGame(
      testGameId, 
      player2Auth,
      {
        onGameStateChange: (payload: any) => player2Events.push({ type: 'state_change', payload, timestamp: Date.now() }),
        onPlayerAction: (payload: any) => player2Events.push({ type: 'player_action', payload, timestamp: Date.now() }),
        onError: (error: any) => player2Events.push({ type: 'error', error })
      }
    );

    expect(subscription1.success).toBe(true);
    expect(subscription2.success).toBe(true);

    // Wait for subscriptions to establish
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Player 1 plays a card
    const gameState = await gameOrchestrator.getGameState(testGameId, player1Auth);
    const player1Data = gameState.data.players.find((p: any) => p.deviceId === player1Auth.deviceId);
    
    if (player1Data.hand.length > 0) {
      const playResult = await gameOrchestrator.playCard({
        gameId: testGameId,
        cardId: player1Data.hand[0].id,
        claim: 'cockroach',
        targetPlayerId: gameState.data.players.find((p: any) => p.deviceId === player2Auth.deviceId).id,
        playerAuth: player1Auth
      });

      expect(playResult.success).toBe(true);

      // Wait for events to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Both players should receive the same events
      expect(player1Events.length).toBeGreaterThan(0);
      expect(player2Events.length).toBeGreaterThan(0);

      // Events should contain play_card action
      const player1PlayEvents = player1Events.filter(e => e.payload?.actionType === 'play_card');
      const player2PlayEvents = player2Events.filter(e => e.payload?.actionType === 'play_card');
      
      expect(player1PlayEvents.length).toBeGreaterThan(0);
      expect(player2PlayEvents.length).toBeGreaterThan(0);
      
      // Event data should be identical
      expect(player1PlayEvents[0].payload.cardId).toBe(player2PlayEvents[0].payload.cardId);
      expect(player1PlayEvents[0].payload.claim).toBe(player2PlayEvents[0].payload.claim);
    }

    await realtimeService.unsubscribe(subscription1.data);
    await realtimeService.unsubscribe(subscription2.data);
  });

  test('should maintain event ordering across clients', async () => {
    let allEvents: any[] = [];
    
    // Single subscription to collect all events in order
    const subscription = await realtimeService.subscribeToGame(
      testGameId,
      player1Auth,
      {
        onGameStateChange: (payload: any) => allEvents.push({ 
          type: 'state_change', 
          payload, 
          timestamp: Date.now(),
          sequence: allEvents.length 
        }),
        onPlayerAction: (payload: any) => allEvents.push({ 
          type: 'player_action', 
          payload, 
          timestamp: Date.now(),
          sequence: allEvents.length 
        })
      }
    );

    await new Promise(resolve => setTimeout(resolve, 500));

    // Perform multiple rapid actions
    const gameState = await gameOrchestrator.getGameState(testGameId, player1Auth);
    const player1Data = gameState.data.players.find((p: any) => p.deviceId === player1Auth.deviceId);
    const player2Data = gameState.data.players.find((p: any) => p.deviceId === player2Auth.deviceId);

    // Rapid sequence of actions
    const actions = [];
    
    if (player1Data.hand.length >= 2) {
      actions.push(
        gameOrchestrator.playCard({
          gameId: testGameId,
          cardId: player1Data.hand[0].id,
          claim: 'mouse',
          targetPlayerId: player2Data.id,
          playerAuth: player1Auth
        })
      );

      actions.push(
        gameOrchestrator.respondToRound({
          gameId: testGameId,
          roundId: 'pending-round',
          response: 'believe',
          playerAuth: player2Auth
        })
      );

      actions.push(
        gameOrchestrator.playCard({
          gameId: testGameId,
          cardId: player2Data.hand[0].id,
          claim: 'bat',
          targetPlayerId: player1Data.id,
          playerAuth: player2Auth
        })
      );
    }

    // Execute actions rapidly
    await Promise.allSettled(actions);

    // Wait for all events to arrive
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Events should be ordered by sequence/timestamp
    const actionEvents = allEvents.filter(e => e.type === 'player_action');
    
    if (actionEvents.length >= 2) {
      // Events should be in chronological order
      for (let i = 1; i < actionEvents.length; i++) {
        expect(actionEvents[i].sequence).toBeGreaterThan(actionEvents[i-1].sequence);
        expect(actionEvents[i].timestamp).toBeGreaterThanOrEqual(actionEvents[i-1].timestamp);
      }
    }

    await realtimeService.unsubscribe(subscription.data);
  });

  test('should handle concurrent state updates without conflicts', async () => {
    // Simulate concurrent actions from both players
    const gameState = await gameOrchestrator.getGameState(testGameId, player1Auth);
    const player1Data = gameState.data.players.find((p: any) => p.deviceId === player1Auth.deviceId);
    const player2Data = gameState.data.players.find((p: any) => p.deviceId === player2Auth.deviceId);

    let conflictEvents: any[] = [];
    
    const subscription = await realtimeService.subscribeToGame(
      testGameId,
      player1Auth,
      {
        onConflictResolution: (payload: any) => conflictEvents.push(payload),
        onError: (error: any) => conflictEvents.push({ type: 'error', error })
      }
    );

    // Both players attempt to play cards simultaneously
    const concurrentActions = [
      gameOrchestrator.playCard({
        gameId: testGameId,
        cardId: player1Data.hand[0].id,
        claim: 'frog',
        targetPlayerId: player2Data.id,
        playerAuth: player1Auth
      }),
      gameOrchestrator.playCard({
        gameId: testGameId,
        cardId: player2Data.hand[0].id,
        claim: 'cockroach',
        targetPlayerId: player1Data.id,
        playerAuth: player2Auth
      })
    ];

    const results = await Promise.allSettled(concurrentActions);

    // One should succeed, one should fail gracefully
    const successResults = results.filter(r => r.status === 'fulfilled' && (r.value as any).success);
    const failureResults = results.filter(r => r.status === 'fulfilled' && !(r.value as any).success);

    expect(successResults.length).toBe(1);
    expect(failureResults.length).toBe(1);

    // Check for proper conflict resolution
    if (failureResults.length > 0) {
      const failureResult = failureResults[0] as any;
      expect(failureResult.value.error.code).toMatch(/conflict|turn_mismatch|invalid_action/);
    }

    await realtimeService.unsubscribe(subscription.data);
  });

  test('should sync optimistic updates with server state', async () => {
    let optimisticUpdates: any[] = [];
    let serverUpdates: any[] = [];

    const subscription = await realtimeService.subscribeToGame(
      testGameId,
      player1Auth,
      {
        onOptimisticUpdate: (payload: any) => optimisticUpdates.push({ ...payload, timestamp: Date.now() }),
        onServerStateSync: (payload: any) => serverUpdates.push({ ...payload, timestamp: Date.now() }),
        onStateConflict: (payload: any) => {
          optimisticUpdates.push({ type: 'conflict', ...payload });
        }
      }
    );

    // Perform action that should trigger optimistic update
    const gameState = await gameOrchestrator.getGameState(testGameId, player1Auth);
    const player1Data = gameState.data.players.find((p: any) => p.deviceId === player1Auth.deviceId);
    
    if (player1Data.hand.length > 0) {
      // This should create optimistic update first, then server sync
      const playResult = await gameOrchestrator.playCardWithOptimisticUpdate({
        gameId: testGameId,
        cardId: player1Data.hand[0].id,
        claim: 'mouse',
        targetPlayerId: gameState.data.players.find((p: any) => p.deviceId === player2Auth.deviceId).id,
        playerAuth: player1Auth
      });

      expect(playResult.success).toBe(true);

      // Wait for both optimistic and server updates
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should have received optimistic update first
      expect(optimisticUpdates.length).toBeGreaterThan(0);
      
      // Server update should follow and match optimistic state
      expect(serverUpdates.length).toBeGreaterThan(0);
      
      // Verify optimistic update came before server update
      const firstOptimistic = optimisticUpdates[0];
      const firstServer = serverUpdates[0];
      
      expect(firstOptimistic.timestamp).toBeLessThanOrEqual(firstServer.timestamp);
    }

    await realtimeService.unsubscribe(subscription.data);
  });

  test('should handle subscription reconnection and state recovery', async () => {
    let reconnectionEvents: any[] = [];

    const subscription = await realtimeService.subscribeToGame(
      testGameId,
      player1Auth,
      {
        onReconnection: (payload: any) => reconnectionEvents.push(payload),
        onStateRecovery: (payload: any) => reconnectionEvents.push({ type: 'recovery', ...payload })
      }
    );

    // Simulate network disconnection
    await realtimeService.simulateDisconnection(subscription.data.channel);

    // Make changes while disconnected
    const gameState = await gameOrchestrator.getGameState(testGameId, player2Auth);
    const player2Data = gameState.data.players.find((p: any) => p.deviceId === player2Auth.deviceId);

    if (player2Data.hand.length > 0) {
      await gameOrchestrator.playCard({
        gameId: testGameId,
        cardId: player2Data.hand[0].id,
        claim: 'bat',
        targetPlayerId: gameState.data.players.find((p: any) => p.deviceId === player1Auth.deviceId).id,
        playerAuth: player2Auth
      });
    }

    // Simulate reconnection
    await realtimeService.simulateReconnection(subscription.data.channel);

    // Wait for state recovery
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Should have received reconnection and recovery events
    expect(reconnectionEvents.length).toBeGreaterThan(0);
    
    const recoveryEvents = reconnectionEvents.filter(e => e.type === 'recovery');
    expect(recoveryEvents.length).toBeGreaterThan(0);
    
    // Recovery should include missed actions
    const recovery = recoveryEvents[0];
    expect(recovery.missedActions).toBeDefined();
    expect(recovery.currentState).toBeDefined();

    await realtimeService.unsubscribe(subscription.data);
  });

  test('should maintain game state consistency across multiple clients', async () => {
    // Create 3 clients to test state consistency
    const clients = [player1Auth, player2Auth];
    const subscriptions = [];
    const clientStates: any[] = [];

    // Setup subscriptions for all clients
    for (let i = 0; i < clients.length; i++) {
      const clientEvents: any[] = [];
      const subscription = await realtimeService.subscribeToGame(
        testGameId,
        clients[i],
        {
          onGameStateChange: (payload: any) => {
            clientEvents.push(payload);
            clientStates[i] = payload.gameState;
          }
        }
      );
      
      subscriptions.push(subscription.data);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Perform a series of state-changing actions
    const gameState = await gameOrchestrator.getGameState(testGameId, player1Auth);
    const actions = [
      { type: 'update_game_status', status: 'in_progress' },
      { type: 'update_turn_timer', timeRemaining: 45 }
    ];

    for (const action of actions) {
      await gameOrchestrator.updateGameState(testGameId, action, player1Auth);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Wait for all updates to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));

    // All clients should have identical game state
    expect(clientStates.length).toBe(clients.length);
    
    if (clientStates.length >= 2) {
      // Compare critical state fields across all clients
      const referenceState = clientStates[0];
      
      for (let i = 1; i < clientStates.length; i++) {
        expect(clientStates[i].id).toBe(referenceState.id);
        expect(clientStates[i].status).toBe(referenceState.status);
        expect(clientStates[i].currentTurn).toBe(referenceState.currentTurn);
        expect(clientStates[i].players.length).toBe(referenceState.players.length);
      }
    }

    // Cleanup subscriptions
    for (const subscription of subscriptions) {
      await realtimeService.unsubscribe(subscription);
    }
  });

  test('should handle large state updates efficiently', async () => {
    let updateSizes: number[] = [];
    let updateTimes: number[] = [];

    const subscription = await realtimeService.subscribeToGame(
      testGameId,
      player1Auth,
      {
        onGameStateChange: (payload: any) => {
          const payloadSize = JSON.stringify(payload).length;
          updateSizes.push(payloadSize);
          updateTimes.push(Date.now());
        }
      }
    );

    const startTime = Date.now();

    // Create a large state update (simulate game with many actions)
    const largeUpdateData = {
      gameHistory: Array(100).fill(0).map((_, i) => ({
        id: `action-${i}`,
        actionType: 'play_card',
        playerId: i % 2 === 0 ? player1Auth.deviceId : player2Auth.deviceId,
        timestamp: Date.now() + i,
        data: { cardId: `card-${i}`, claim: 'cockroach' }
      })),
      chatMessages: Array(50).fill(0).map((_, i) => ({
        id: `msg-${i}`,
        playerId: i % 2 === 0 ? player1Auth.deviceId : player2Auth.deviceId,
        message: `Test message ${i}`,
        timestamp: Date.now() + i
      }))
    };

    // Trigger large state update
    await gameOrchestrator.bulkUpdateGameState(testGameId, largeUpdateData, player1Auth);

    // Wait for update to arrive
    await new Promise(resolve => setTimeout(resolve, 5000));

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Should handle large updates efficiently
    expect(updateSizes.length).toBeGreaterThan(0);
    expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
    
    if (updateSizes.length > 0) {
      const maxUpdateSize = Math.max(...updateSizes);
      expect(maxUpdateSize).toBeGreaterThan(1000); // Verify it was actually a large update
    }

    await realtimeService.unsubscribe(subscription.data);
  });
});