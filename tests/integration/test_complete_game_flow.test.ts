/**
 * T022: Integration test - Complete 2-player game flow
 * Tests the entire game lifecycle from matchmaking to game completion
 * MUST FAIL before implementation exists
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';

describe('Complete Game Flow Integration', () => {
  let gameOrchestrator: any;
  let player1Auth: any;
  let player2Auth: any;
  let gameSession: any;

  beforeAll(async () => {
    // This will fail until we implement the game orchestrator
    const { GameOrchestrator } = await import('../../src/lib/gameLogic/GameOrchestrator');
    const { AuthService } = await import('../../src/services/authService');
    
    gameOrchestrator = new GameOrchestrator();
    
    // Create two test players
    player1Auth = await AuthService.authenticateWithDeviceId('integration-player-1');
    player2Auth = await AuthService.authenticateWithDeviceId('integration-player-2');
  });

  afterAll(async () => {
    // Cleanup test game
    if (gameSession?.gameId) {
      await gameOrchestrator.cleanupGame(gameSession.gameId);
    }
  });

  test('should complete full 2-player game lifecycle', async () => {
    // Step 1: Start matchmaking for both players
    const matchmaking1 = await gameOrchestrator.findMatch({
      playerAuth: player1Auth,
      displayName: 'Player 1',
      gameSettings: { winCondition: 3, turnTimeLimit: 60 }
    });
    
    const matchmaking2 = await gameOrchestrator.findMatch({
      playerAuth: player2Auth,
      displayName: 'Player 2', 
      gameSettings: { winCondition: 3, turnTimeLimit: 60 }
    });

    expect(matchmaking1.success).toBe(true);
    expect(matchmaking2.success).toBe(true);
    expect(matchmaking1.data.gameId).toBe(matchmaking2.data.gameId);

    gameSession = matchmaking1.data;

    // Step 2: Verify game initialization
    const gameState = await gameOrchestrator.getGameState(gameSession.gameId, player1Auth);
    expect(gameState.success).toBe(true);
    expect(gameState.data.status).toBe('in_progress');
    expect(gameState.data.players).toHaveLength(2);
    
    // Each player should have 9 cards in hand
    const player1Hand = gameState.data.players.find((p: any) => p.deviceId === player1Auth.deviceId);
    const player2Hand = gameState.data.players.find((p: any) => p.deviceId === player2Auth.deviceId);
    expect(player1Hand.hand).toHaveLength(9);
    expect(player2Hand.hand).toHaveLength(9);

    // Step 3: Play complete rounds until game ends
    let currentGameState = gameState.data;
    let roundCount = 0;
    const maxRounds = 50; // Safety limit

    while (currentGameState.status === 'in_progress' && roundCount < maxRounds) {
      const currentPlayer = currentGameState.currentTurn === player1Hand.id ? player1Auth : player2Auth;
      const targetPlayer = currentGameState.currentTurn === player1Hand.id ? player2Hand.id : player1Hand.id;
      const currentPlayerHand = currentGameState.currentTurn === player1Hand.id ? player1Hand : player2Hand;

      if (currentPlayerHand.hand.length === 0) {
        break; // No more cards to play
      }

      // Play a card with a claim
      const cardToPlay = currentPlayerHand.hand[0];
      const claim = ['cockroach', 'mouse', 'bat', 'frog'][Math.floor(Math.random() * 4)];
      
      const playResult = await gameOrchestrator.playCard({
        gameId: gameSession.gameId,
        cardId: cardToPlay.id,
        claim,
        targetPlayerId: targetPlayer,
        playerAuth: currentPlayer
      });

      expect(playResult.success).toBe(true);

      // Target player responds (randomly believe/disbelieve/pass_back)
      const responses = ['believe', 'disbelieve', 'pass_back'];
      const response = responses[Math.floor(Math.random() * responses.length)];
      
      if (response !== 'pass_back') {
        const respondResult = await gameOrchestrator.respondToRound({
          gameId: gameSession.gameId,
          roundId: playResult.data.roundId,
          response,
          playerAuth: currentPlayer === player1Auth ? player2Auth : player1Auth
        });

        expect(respondResult.success).toBe(true);
      }

      // Get updated game state
      const updatedState = await gameOrchestrator.getGameState(gameSession.gameId, player1Auth);
      currentGameState = updatedState.data;
      roundCount++;
    }

    // Step 4: Verify game completion
    expect(currentGameState.status).toMatch(/ended|abandoned/);
    if (currentGameState.status === 'ended') {
      expect(currentGameState.winnerId).toBeDefined();
      expect(currentGameState.endedAt).toBeDefined();
      
      // Winner should be the player who didn't reach win condition
      const winner = currentGameState.players.find((p: any) => p.id === currentGameState.winnerId);
      expect(winner).toBeDefined();
      
      // Verify penalty pile counts don't exceed win condition
      const loser = currentGameState.players.find((p: any) => p.id !== currentGameState.winnerId);
      const penaltyCounts = Object.values(loser.penaltyPile).map((pile: any) => pile.length);
      expect(Math.max(...penaltyCounts)).toBeGreaterThanOrEqual(currentGameState.settings.winCondition);
    }

    // Step 5: Verify game history is recorded
    const historyResult = await gameOrchestrator.getGameHistory(gameSession.gameId, player1Auth);
    expect(historyResult.success).toBe(true);
    expect(historyResult.data.length).toBeGreaterThan(0);
    
    // Should have join_game actions for both players
    const joinActions = historyResult.data.filter((action: any) => action.actionType === 'join_game');
    expect(joinActions).toHaveLength(2);
  }, 30000); // 30 second timeout for full game
});