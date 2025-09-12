/**
 * T024: Integration test - Matchmaking process
 * Tests matchmaking queue, player pairing, and game creation flow  
 * MUST FAIL before implementation exists
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('Matchmaking Flow Integration', () => {
  let matchmakingService: any;
  let gameOrchestrator: any;
  let testPlayerAuths: any[] = [];
  let activeGames: string[] = [];

  beforeAll(async () => {
    // This will fail until we implement matchmaking
    const { MatchmakingService } = await import('../../src/services/matchmakingService');
    const { GameOrchestrator } = await import('../../src/lib/gameLogic/GameOrchestrator');
    const { AuthService } = await import('../../src/services/authService');
    
    matchmakingService = new MatchmakingService();
    gameOrchestrator = new GameOrchestrator();
    
    // Create multiple test players
    for (let i = 1; i <= 6; i++) {
      const auth = await AuthService.authenticateWithDeviceId(`matchmaking-player-${i}`);
      testPlayerAuths.push(auth);
    }
  });

  afterAll(async () => {
    // Cleanup all test games
    for (const gameId of activeGames) {
      await gameOrchestrator.cleanupGame(gameId);
    }
  });

  test('should queue single player and wait for match', async () => {
    const player1 = testPlayerAuths[0];
    
    const matchRequest = await matchmakingService.findMatch({
      playerAuth: player1,
      displayName: 'Player 1',
      gameSettings: {
        winCondition: 3,
        turnTimeLimit: 60
      },
      maxWaitTime: 30000 // 30 seconds
    });

    expect(matchRequest.success).toBe(true);
    expect(matchRequest.data.matchmakingId).toBeDefined();
    expect(matchRequest.data.status).toBe('searching');
    expect(matchRequest.data.queuePosition).toBeDefined();

    // Check matchmaking status
    const statusCheck = await matchmakingService.getMatchmakingStatus(
      matchRequest.data.matchmakingId,
      player1
    );

    expect(statusCheck.success).toBe(true);
    expect(statusCheck.data.status).toMatch(/searching|waiting/);
    expect(statusCheck.data.playersFound).toBe(1);
    expect(statusCheck.data.playersNeeded).toBe(2);
  });

  test('should match two players and create game', async () => {
    const player1 = testPlayerAuths[1];
    const player2 = testPlayerAuths[2];

    // Both players request matchmaking simultaneously
    const matchRequest1Promise = matchmakingService.findMatch({
      playerAuth: player1,
      displayName: 'Player A',
      gameSettings: { winCondition: 3, turnTimeLimit: 60 }
    });

    const matchRequest2Promise = matchmakingService.findMatch({
      playerAuth: player2,
      displayName: 'Player B',
      gameSettings: { winCondition: 3, turnTimeLimit: 60 }
    });

    const [matchResult1, matchResult2] = await Promise.all([
      matchRequest1Promise,
      matchRequest2Promise
    ]);

    expect(matchResult1.success).toBe(true);
    expect(matchResult2.success).toBe(true);

    // Should be matched to the same game
    expect(matchResult1.data.gameId).toBe(matchResult2.data.gameId);
    expect(matchResult1.data.status).toBe('matched');
    expect(matchResult2.data.status).toBe('matched');

    const gameId = matchResult1.data.gameId;
    activeGames.push(gameId);

    // Verify game is created and players are joined
    const gameState = await gameOrchestrator.getGameState(gameId, player1);
    expect(gameState.success).toBe(true);
    expect(gameState.data.status).toBe('in_progress');
    expect(gameState.data.players).toHaveLength(2);

    const playerNames = gameState.data.players.map((p: any) => p.displayName);
    expect(playerNames).toContain('Player A');
    expect(playerNames).toContain('Player B');
  });

  test('should handle matchmaking with different game settings', async () => {
    const player1 = testPlayerAuths[3];
    const player2 = testPlayerAuths[4];

    // Player 1 requests game with winCondition 2
    const matchRequest1 = await matchmakingService.findMatch({
      playerAuth: player1,
      displayName: 'Fast Player',
      gameSettings: { winCondition: 2, turnTimeLimit: 30 }
    });

    // Player 2 requests game with winCondition 3 
    const matchRequest2 = await matchmakingService.findMatch({
      playerAuth: player2,
      displayName: 'Normal Player',
      gameSettings: { winCondition: 3, turnTimeLimit: 60 }
    });

    expect(matchRequest1.success).toBe(true);
    expect(matchRequest2.success).toBe(true);

    // Should NOT match due to different settings
    await new Promise(resolve => setTimeout(resolve, 2000));

    const status1 = await matchmakingService.getMatchmakingStatus(
      matchRequest1.data.matchmakingId,
      player1
    );
    const status2 = await matchmakingService.getMatchmakingStatus(
      matchRequest2.data.matchmakingId,
      player2
    );

    expect(status1.data.status).toBe('searching');
    expect(status2.data.status).toBe('searching');
    expect(status1.data.gameId).not.toBe(status2.data.gameId);
  });

  test('should handle matchmaking timeout', async () => {
    const player = testPlayerAuths[5];

    const matchRequest = await matchmakingService.findMatch({
      playerAuth: player,
      displayName: 'Lonely Player',
      gameSettings: { winCondition: 3, turnTimeLimit: 60 },
      maxWaitTime: 3000 // 3 seconds timeout
    });

    expect(matchRequest.success).toBe(true);

    // Wait for timeout
    await new Promise(resolve => setTimeout(resolve, 4000));

    const finalStatus = await matchmakingService.getMatchmakingStatus(
      matchRequest.data.matchmakingId,
      player
    );

    expect(finalStatus.data.status).toBe('timeout');
    expect(finalStatus.data.gameId).toBeNull();
  });

  test('should allow player to cancel matchmaking', async () => {
    const player = testPlayerAuths[0];

    const matchRequest = await matchmakingService.findMatch({
      playerAuth: player,
      displayName: 'Indecisive Player',
      gameSettings: { winCondition: 3, turnTimeLimit: 60 }
    });

    expect(matchRequest.success).toBe(true);

    // Cancel matchmaking
    const cancelResult = await matchmakingService.cancelMatchmaking(
      matchRequest.data.matchmakingId,
      player
    );

    expect(cancelResult.success).toBe(true);

    // Verify status is cancelled
    const status = await matchmakingService.getMatchmakingStatus(
      matchRequest.data.matchmakingId,
      player
    );

    expect(status.data.status).toBe('cancelled');
  });

  test('should handle multiple concurrent matchmaking requests', async () => {
    // Create 4 players requesting matches simultaneously
    const players = testPlayerAuths.slice(0, 4);
    
    const matchPromises = players.map((player, index) =>
      matchmakingService.findMatch({
        playerAuth: player,
        displayName: `Concurrent Player ${index + 1}`,
        gameSettings: { winCondition: 3, turnTimeLimit: 60 }
      })
    );

    const matchResults = await Promise.all(matchPromises);

    // All should succeed
    matchResults.forEach(result => {
      expect(result.success).toBe(true);
    });

    // Wait for matching to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Should create 2 games with 2 players each
    const gameIds = new Set(matchResults.map(r => r.data.gameId));
    expect(gameIds.size).toBe(2);

    // Verify each game has exactly 2 players
    for (const gameId of gameIds) {
      if (gameId) {
        activeGames.push(gameId);
        const gameState = await gameOrchestrator.getGameState(gameId, players[0]);
        expect(gameState.success).toBe(true);
        expect(gameState.data.players).toHaveLength(2);
      }
    }
  });

  test('should maintain matchmaking queue integrity', async () => {
    // Get current queue statistics
    const queueStats = await matchmakingService.getQueueStatistics();
    expect(queueStats.success).toBe(true);
    expect(queueStats.data.totalPlayersInQueue).toBeGreaterThanOrEqual(0);
    expect(queueStats.data.averageWaitTime).toBeGreaterThanOrEqual(0);
    expect(queueStats.data.activeMatches).toBeGreaterThanOrEqual(0);

    // Queue should be empty or have reasonable numbers
    expect(queueStats.data.totalPlayersInQueue).toBeLessThan(100);
    expect(queueStats.data.averageWaitTime).toBeLessThan(60000); // Less than 1 minute
  });
});