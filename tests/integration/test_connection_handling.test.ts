/**
 * T023: Integration test - Player connection/disconnection handling
 * Tests network resilience, reconnection, and game state recovery
 * MUST FAIL before implementation exists
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('Connection Handling Integration', () => {
  let connectionManager: any;
  let realtimeService: any;
  let gameOrchestrator: any;
  let player1Auth: any;
  let player2Auth: any;
  let testGameId: string;

  beforeAll(async () => {
    // This will fail until we implement connection management
    const { ConnectionManager } = await import('../../src/services/connectionManager');
    const { RealtimeService } = await import('../../src/services/realtimeService');
    const { GameOrchestrator } = await import('../../src/lib/gameLogic/GameOrchestrator');
    const { AuthService } = await import('../../src/services/authService');
    
    connectionManager = new ConnectionManager();
    realtimeService = new RealtimeService();
    gameOrchestrator = new GameOrchestrator();
    
    player1Auth = await AuthService.authenticateWithDeviceId('connection-test-player-1');
    player2Auth = await AuthService.authenticateWithDeviceId('connection-test-player-2');
    
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

  test('should handle player disconnection gracefully', async () => {
    // Verify both players are initially connected
    let gameState = await gameOrchestrator.getGameState(testGameId, player1Auth);
    expect(gameState.success).toBe(true);
    
    const player1 = gameState.data.players.find((p: any) => p.deviceId === player1Auth.deviceId);
    const player2 = gameState.data.players.find((p: any) => p.deviceId === player2Auth.deviceId);
    
    expect(player1.isConnected).toBe(true);
    expect(player2.isConnected).toBe(true);

    // Simulate player 1 disconnection
    const disconnectionResult = await connectionManager.simulateDisconnection(player1.id, testGameId);
    expect(disconnectionResult.success).toBe(true);

    // Wait for disconnection to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify player 1 is marked as disconnected
    gameState = await gameOrchestrator.getGameState(testGameId, player2Auth);
    const disconnectedPlayer = gameState.data.players.find((p: any) => p.deviceId === player1Auth.deviceId);
    expect(disconnectedPlayer.isConnected).toBe(false);
    expect(disconnectedPlayer.lastSeen).toBeDefined();

    // Game should pause or handle gracefully
    expect(gameState.data.status).toMatch(/in_progress|paused/);
  });

  test('should handle player reconnection and state recovery', async () => {
    // Simulate player 1 reconnection
    const reconnectionResult = await connectionManager.handleReconnection(
      player1Auth,
      testGameId
    );
    
    expect(reconnectionResult.success).toBe(true);
    expect(reconnectionResult.data.gameState).toBeDefined();
    expect(reconnectionResult.data.missedActions).toBeDefined();

    // Verify player is marked as connected
    const gameState = await gameOrchestrator.getGameState(testGameId, player1Auth);
    const reconnectedPlayer = gameState.data.players.find((p: any) => p.deviceId === player1Auth.deviceId);
    expect(reconnectedPlayer.isConnected).toBe(true);

    // Verify game state is properly synchronized
    expect(gameState.data.status).toBe('in_progress');
    expect(reconnectedPlayer.hand).toBeDefined();
    expect(reconnectedPlayer.penaltyPile).toBeDefined();
  });

  test('should sync missed actions during reconnection', async () => {
    // Player 1 disconnects
    await connectionManager.simulateDisconnection(player1Auth, testGameId);

    // Player 2 performs actions while player 1 is disconnected
    const player2State = await gameOrchestrator.getGameState(testGameId, player2Auth);
    const player2Data = player2State.data.players.find((p: any) => p.deviceId === player2Auth.deviceId);
    
    if (player2Data.hand.length > 0 && player2State.data.currentTurn === player2Data.id) {
      const playResult = await gameOrchestrator.playCard({
        gameId: testGameId,
        cardId: player2Data.hand[0].id,
        claim: 'cockroach',
        targetPlayerId: player2State.data.players.find((p: any) => p.deviceId === player1Auth.deviceId).id,
        playerAuth: player2Auth
      });
      
      expect(playResult.success).toBe(true);
    }

    // Player 1 reconnects
    const reconnectionResult = await connectionManager.handleReconnection(
      player1Auth,
      testGameId
    );

    expect(reconnectionResult.success).toBe(true);
    expect(reconnectionResult.data.missedActions).toBeDefined();
    expect(reconnectionResult.data.missedActions.length).toBeGreaterThan(0);

    // Verify missed actions contain the play_card action
    const playCardActions = reconnectionResult.data.missedActions.filter(
      (action: any) => action.actionType === 'play_card'
    );
    expect(playCardActions.length).toBeGreaterThan(0);
  });

  test('should handle simultaneous disconnections', async () => {
    // Both players disconnect simultaneously
    const disconnection1 = connectionManager.simulateDisconnection(player1Auth, testGameId);
    const disconnection2 = connectionManager.simulateDisconnection(player2Auth, testGameId);
    
    const results = await Promise.all([disconnection1, disconnection2]);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);

    // Wait for disconnections to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Game should be marked as abandoned after grace period
    const gameState = await gameOrchestrator.getGameState(testGameId, player1Auth);
    expect(gameState.data.status).toMatch(/abandoned|paused/);

    // Both players should be marked as disconnected
    gameState.data.players.forEach((player: any) => {
      expect(player.isConnected).toBe(false);
    });
  });

  test('should handle realtime subscription recovery', async () => {
    // Establish realtime subscription
    let receivedEvents: any[] = [];
    
    const subscription = await realtimeService.subscribeToGame(
      testGameId,
      player1Auth,
      {
        onGameStateChange: (payload: any) => receivedEvents.push({ type: 'state_change', payload }),
        onPlayerAction: (payload: any) => receivedEvents.push({ type: 'player_action', payload }),
        onError: (error: any) => receivedEvents.push({ type: 'error', error })
      }
    );

    expect(subscription.success).toBe(true);

    // Simulate connection interruption and recovery
    await connectionManager.simulateNetworkInterruption(subscription.data.channel);
    
    // Wait for recovery
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify subscription is restored
    const subscriptionStatus = await realtimeService.getSubscriptionStatus(subscription.data.channel);
    expect(subscriptionStatus.connected).toBe(true);

    // Verify events are received after recovery
    const initialEventCount = receivedEvents.length;
    
    // Trigger a game event
    await gameOrchestrator.updateGameStatus(testGameId, 'in_progress', player1Auth);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    expect(receivedEvents.length).toBeGreaterThan(initialEventCount);

    await realtimeService.unsubscribe(subscription.data);
  });

  test('should enforce disconnection timeout policies', async () => {
    // Configure short timeout for testing
    await connectionManager.updateGameSettings(testGameId, {
      reconnectionGracePeriod: 2 // 2 seconds
    });

    // Player 1 disconnects
    await connectionManager.simulateDisconnection(player1Auth, testGameId);

    // Wait beyond grace period
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Game should be abandoned or opponent should win
    const gameState = await gameOrchestrator.getGameState(testGameId, player2Auth);
    expect(gameState.data.status).toMatch(/abandoned|ended/);
    
    if (gameState.data.status === 'ended') {
      const player2 = gameState.data.players.find((p: any) => p.deviceId === player2Auth.deviceId);
      expect(gameState.data.winnerId).toBe(player2.id);
    }
  });
});