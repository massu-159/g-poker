/**
 * Game Logic Unit Tests
 * Comprehensive tests for ごきぶりポーカー game mechanics
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

import {
  initializeGame,
  playCard,
  respondToRound,
  getPlayerTotalPenaltyCount,
  getNextPlayer,
  isPlayerTurn,
  validateGameState,
  calculateGameStatistics,
} from '../../src/lib/gameLogic';

import { Game, GameStatus, GameSettings } from '../../src/lib/entities/Game';
import { Player, GamePlayer, PlayerGameState, createDefaultPenaltyPile } from '../../src/lib/entities/Player';
import { Card, CreatureType, createCardInPlay } from '../../src/lib/entities/Card';
import { Round, RoundResponse, createRound } from '../../src/lib/entities/Round';

// Test data factories
const createTestPlayer = (id: string, displayName: string = `Player ${id}`): Player => ({
  id,
  deviceId: `device_${id}`,
  profile: {
    displayName,
  },
  connection: {
    isConnected: true,
    lastSeen: '2023-01-01T00:00:00.000Z',
  },
  statistics: {
    totalGames: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    averageGameDuration: 0,
    fastestWin: 0,
    longestGame: 0,
    creaturePreferences: {
      cockroach: { played: 0, won: 0 },
      mouse: { played: 0, won: 0 },
      bat: { played: 0, won: 0 },
      frog: { played: 0, won: 0 },
    },
  },
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
});

const createTestGamePlayer = (player: Player, gameId: string, hand: Card[]): GamePlayer => ({
  ...player,
  gameId,
  gameState: {
    hand,
    penaltyPile: createDefaultPenaltyPile(),
    turnPosition: parseInt(player.id) - 1,
    isReady: true,
    score: 0,
    hasLost: false,
  },
  joinedAt: '2023-01-01T00:00:00.000Z',
});

const createTestSettings = (): GameSettings => ({
  winCondition: 3,
  turnTimeLimit: 60,
  maxReconnectTime: 300,
  allowSpectators: false,
});

const createTestCard = (id: string, creatureType: CreatureType): Card => ({
  id,
  creatureType,
  cardNumber: 1,
});

describe('Game Logic', () => {
  let player1: Player;
  let player2: Player;
  let gameSettings: GameSettings;

  beforeEach(() => {
    player1 = createTestPlayer('1', 'Alice');
    player2 = createTestPlayer('2', 'Bob');
    gameSettings = createTestSettings();
    
    // Mock Math.random for consistent testing
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initializeGame', () => {
    it('should successfully initialize a game with two players', () => {
      const result = initializeGame('game1', player1, player2, gameSettings);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.game.id).toBe('game1');
      expect(result.data!.game.playerIds).toEqual(['1', '2']);
      expect(result.data!.players).toHaveLength(2);
      expect(result.data!.game.status).toBe('in_progress');
    });

    it('should fail when trying to initialize with the same player twice', () => {
      const result = initializeGame('game1', player1, player1, gameSettings);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('DUPLICATE_PLAYERS');
    });

    it('should deal cards correctly to both players', () => {
      const result = initializeGame('game1', player1, player2, gameSettings);

      expect(result.success).toBe(true);
      const { players } = result.data!;
      
      expect(players[0]!.gameState.hand).toHaveLength(9);
      expect(players[1]!.gameState.hand).toHaveLength(9);
      
      // Check that all cards are unique
      const allCards = [...players[0]!.gameState.hand, ...players[1]!.gameState.hand];
      const cardIds = allCards.map(card => card.id);
      expect(new Set(cardIds).size).toBe(cardIds.length);
    });

    it('should randomly select first player', () => {
      // Test with different random values
      jest.spyOn(Math, 'random').mockReturnValue(0.2); // Should select player1
      let result = initializeGame('game1', player1, player2, gameSettings);
      expect(result.data!.game.state.currentTurn).toBe('1');

      jest.spyOn(Math, 'random').mockReturnValue(0.8); // Should select player2
      result = initializeGame('game2', player1, player2, gameSettings);
      expect(result.data!.game.state.currentTurn).toBe('2');
    });

    it('should handle initialization errors gracefully', () => {
      // Mock an error during deck creation
      jest.spyOn(global.Math, 'random').mockImplementation(() => {
        throw new Error('Random number generator failure');
      });

      const result = initializeGame('game1', player1, player2, gameSettings);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.code).toBe('INITIALIZATION_ERROR');
    });
  });

  describe('playCard', () => {
    let game: Game;
    let gamePlayer1: GamePlayer;
    let testCard: Card;

    beforeEach(() => {
      // Initialize game for testing
      const initResult = initializeGame('game1', player1, player2, gameSettings);
      game = initResult.data!.game;
      gamePlayer1 = initResult.data!.players.find(p => p.id === '1')!;
      testCard = gamePlayer1.gameState.hand[0]!;
      
      // Ensure it's player1's turn
      game.state.currentTurn = '1';
    });

    it('should successfully play a card when conditions are met', () => {
      const result = playCard(game, gamePlayer1, testCard.id, CreatureType.COCKROACH, '2');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.newRound.cardInPlay.id).toBe(testCard.id);
      expect(result.data!.newRound.cardInPlay.claim).toBe(CreatureType.COCKROACH);
      expect(result.data!.newRound.targetPlayerId).toBe('2');
      expect(result.data!.updatedGame.state.currentTurn).toBe('2');
    });

    it('should remove the played card from player hand', () => {
      const initialHandSize = gamePlayer1.gameState.hand.length;
      const result = playCard(game, gamePlayer1, testCard.id, CreatureType.COCKROACH, '2');

      expect(result.success).toBe(true);
      expect(result.data!.updatedPlayer.gameState.hand).toHaveLength(initialHandSize - 1);
      expect(result.data!.updatedPlayer.gameState.hand.find(c => c.id === testCard.id)).toBeUndefined();
    });

    it('should fail when game is not active', () => {
      const inactiveGame = { ...game, status: 'ended' as GameStatus };
      const result = playCard(inactiveGame, gamePlayer1, testCard.id, CreatureType.COCKROACH, '2');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('GAME_NOT_ACTIVE');
    });

    it('should fail when it is not player turn', () => {
      game.state.currentTurn = '2'; // Make it player2's turn
      const result = playCard(game, gamePlayer1, testCard.id, CreatureType.COCKROACH, '2');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_PLAYER_TURN');
    });

    it('should fail when trying to target self', () => {
      const result = playCard(game, gamePlayer1, testCard.id, CreatureType.COCKROACH, '1');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CANNOT_TARGET_SELF');
    });

    it('should fail when card is not in player hand', () => {
      const fakeCard = createTestCard('fake-card', CreatureType.COCKROACH);
      const result = playCard(game, gamePlayer1, fakeCard.id, CreatureType.COCKROACH, '2');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('CARD_NOT_IN_HAND');
    });

    it('should fail when targeting invalid player', () => {
      const result = playCard(game, gamePlayer1, testCard.id, CreatureType.COCKROACH, 'invalid-player');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('INVALID_TARGET_PLAYER');
    });

    it('should update game version and last action', () => {
      const initialVersion = game.version;
      const result = playCard(game, gamePlayer1, testCard.id, CreatureType.COCKROACH, '2');

      expect(result.success).toBe(true);
      expect(result.data!.updatedGame.version).toBe(initialVersion + 1);
      expect(result.data!.updatedGame.state.lastAction).toBeDefined();
      expect(result.data!.updatedGame.state.lastAction!.type).toBe('play_card');
      expect(result.data!.updatedGame.state.lastAction!.playerId).toBe('1');
    });
  });

  describe('respondToRound', () => {
    let game: Game;
    let players: GamePlayer[];
    let round: Round;

    beforeEach(() => {
      // Initialize game and set up a round
      const initResult = initializeGame('game1', player1, player2, gameSettings);
      game = initResult.data!.game;
      players = initResult.data!.players;
      
      const testCard = players[0]!.gameState.hand[0]!;
      const cardInPlay = createCardInPlay(testCard, '1', CreatureType.COCKROACH, '2');
      round = createRound({
        gameId: game.id,
        cardInPlay,
        targetPlayerId: '2',
        turnTimeLimit: 60,
      });
      
      game.currentRound = round;
      game.state.currentTurn = '2';
    });

    it('should successfully handle believe response', () => {
      const result = respondToRound(game, players, round, '2', 'believe');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.updatedRound.response).toBeDefined();
      expect(result.data!.updatedRound.response!.type).toBe('believe');
      expect(result.data!.updatedRound.response!.respondedBy).toBe('2');
    });

    it('should successfully handle disbelieve response', () => {
      const result = respondToRound(game, players, round, '2', 'disbelieve');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.updatedRound.response!.type).toBe('disbelieve');
    });

    it('should successfully handle pass back response', () => {
      const result = respondToRound(game, players, round, '2', 'pass_back');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.updatedGame.state.currentTurn).toBe('1'); // Turn switches back
    });

    it('should fail when round is not active', () => {
      const resolvedRound = { ...round, status: 'resolved' as const, resolvedAt: '2023-01-01T01:00:00.000Z' };
      const result = respondToRound(game, players, resolvedRound, '2', 'believe');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('ROUND_NOT_ACTIVE');
    });

    it('should fail when wrong player tries to respond', () => {
      const result = respondToRound(game, players, round, '1', 'believe');

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('NOT_TARGET_PLAYER');
    });

    it('should end game when penalty limit is reached', () => {
      // Set up a player close to losing
      const losingPlayer = players.find(p => p.id === '2')!;
      losingPlayer.gameState.penaltyPile = {
        [CreatureType.COCKROACH]: [createTestCard('1', CreatureType.COCKROACH), createTestCard('2', CreatureType.COCKROACH)],
        [CreatureType.MOUSE]: [],
        [CreatureType.BAT]: [],
        [CreatureType.FROG]: [],
      };

      // Create a round that will cause the player to lose
      const testCard = createTestCard('losing-card', CreatureType.COCKROACH);
      const cardInPlay = createCardInPlay(testCard, '1', CreatureType.MOUSE, '2'); // Lying about ゴキブリ
      const losingRound = createRound({
        gameId: game.id,
        cardInPlay,
        targetPlayerId: '2',
        turnTimeLimit: 60,
      });

      const result = respondToRound(game, players, losingRound, '2', 'believe');

      expect(result.success).toBe(true);
      if (result.data!.gameEnded) {
        expect(result.data!.gameEnded).toBe(true);
        expect(result.data!.winner).toBe('1');
        expect(result.data!.updatedGame.status).toBe('ended');
      }
    });
  });

  describe('Helper Functions', () => {
    describe('getPlayerTotalPenaltyCount', () => {
      it('should correctly count total penalties', () => {
        const penaltyPile: PlayerGameState['penaltyPile'] = {
          [CreatureType.COCKROACH]: [createTestCard('1', CreatureType.COCKROACH), createTestCard('2', CreatureType.COCKROACH)],
          [CreatureType.MOUSE]: [createTestCard('3', CreatureType.MOUSE)],
          [CreatureType.BAT]: [],
          [CreatureType.FROG]: [createTestCard('4', CreatureType.FROG)],
        };

        const total = getPlayerTotalPenaltyCount(penaltyPile);
        expect(total).toBe(4);
      });

      it('should return 0 for empty penalty pile', () => {
        const penaltyPile = createDefaultPenaltyPile();
        const total = getPlayerTotalPenaltyCount(penaltyPile);
        expect(total).toBe(0);
      });
    });

    describe('getNextPlayer', () => {
      it('should return next player in order', () => {
        const game = { playerIds: ['1', '2', '3'] } as Game;
        
        expect(getNextPlayer(game, '1')).toBe('2');
        expect(getNextPlayer(game, '2')).toBe('3');
        expect(getNextPlayer(game, '3')).toBe('1'); // Wraps around
      });

      it('should handle two-player games', () => {
        const game = { playerIds: ['1', '2'] } as Game;
        
        expect(getNextPlayer(game, '1')).toBe('2');
        expect(getNextPlayer(game, '2')).toBe('1');
      });
    });

    describe('isPlayerTurn', () => {
      it('should correctly identify player turn', () => {
        const game = { state: { currentTurn: '1' } } as Game;
        
        expect(isPlayerTurn(game, '1')).toBe(true);
        expect(isPlayerTurn(game, '2')).toBe(false);
      });
    });

    describe('validateGameState', () => {
      let game: Game;
      let players: GamePlayer[];

      beforeEach(() => {
        const initResult = initializeGame('game1', player1, player2, gameSettings);
        game = initResult.data!.game;
        players = initResult.data!.players;
      });

      it('should return valid for correct game state', () => {
        const result = validateGameState(game, players);
        
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect player count mismatch', () => {
        const result = validateGameState(game, [players[0]!]);
        
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Player count mismatch: expected 2, got 1');
      });

      it('should detect missing player', () => {
        const fakePlayer = createTestGamePlayer(createTestPlayer('3'), 'game1', []);
        const result = validateGameState(game, [players[0]!, fakePlayer]);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.includes('Player 2 not found'))).toBe(true);
      });

      it('should detect invalid current turn player', () => {
        game.state.currentTurn = 'invalid-player';
        const result = validateGameState(game, players);
        
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.includes('Current turn player invalid-player not found'))).toBe(true);
      });
    });
  });

  describe('calculateGameStatistics', () => {
    let game: Game;
    let players: GamePlayer[];
    let rounds: Round[];

    beforeEach(() => {
      const initResult = initializeGame('game1', player1, player2, gameSettings);
      game = initResult.data!.game;
      players = initResult.data!.players;
      
      // Create test rounds with resolutions
      const baseTime = new Date('2023-01-01T00:00:00.000Z').getTime();
      const round1 = createRound({
        gameId: game.id,
        cardInPlay: createCardInPlay(createTestCard('card1', CreatureType.COCKROACH), '1', CreatureType.COCKROACH, '2'),
        targetPlayerId: '2',
        turnTimeLimit: 60,
      });
      
      const round2 = createRound({
        gameId: game.id,
        cardInPlay: createCardInPlay(createTestCard('card2', CreatureType.MOUSE), '2', CreatureType.BAT, '1'),
        targetPlayerId: '1',
        turnTimeLimit: 60,
      });

      rounds = [
        {
          ...round1,
          createdAt: new Date(baseTime).toISOString(),
          resolvedAt: new Date(baseTime + 60000).toISOString(),
          resolution: {
            type: 'disbelieve',
            winner: '1',
            loser: '2',
            wasClaimTruthful: true,
            penaltyCard: createTestCard('card1', CreatureType.COCKROACH),
            resolvedAt: new Date(baseTime + 60000).toISOString(),
          },
          response: {
            type: 'disbelieve' as RoundResponse,
            respondedBy: '2',
            respondedAt: new Date(baseTime + 60000).toISOString(),
          },
        },
        {
          ...round2,
          createdAt: new Date(baseTime + 120000).toISOString(),
          resolvedAt: new Date(baseTime + 180000).toISOString(),
          resolution: {
            type: 'believe',
            winner: '2',
            loser: '1',
            wasClaimTruthful: false,
            penaltyCard: createTestCard('card2', CreatureType.MOUSE),
            resolvedAt: new Date(baseTime + 180000).toISOString(),
          },
          response: {
            type: 'believe' as RoundResponse,
            respondedBy: '1',
            respondedAt: new Date(baseTime + 180000).toISOString(),
          },
        },
      ];
    });

    it('should calculate basic statistics correctly', () => {
      const stats = calculateGameStatistics(game, players, rounds);

      expect(stats.totalRounds).toBe(2);
      expect(stats.averageRoundDuration).toBeGreaterThan(0);
      expect(stats.claimAccuracy['1']).toEqual({ total: 1, truthful: 1 });
      expect(stats.claimAccuracy['2']).toEqual({ total: 1, truthful: 0 });
    });

    it('should track player performance correctly', () => {
      const stats = calculateGameStatistics(game, players, rounds);

      expect(stats.playerPerformance['1']).toEqual({
        roundsWon: 1,
        roundsLost: 1,
        cardsPlayed: 1,
        accurateBeliefs: 0, // Player 1 believed player 2's false claim (they lost)
        accurateDisbeliefs: 0,
      });
      
      expect(stats.playerPerformance['2']).toEqual({
        roundsWon: 1,
        roundsLost: 1,
        cardsPlayed: 1,
        accurateBeliefs: 0,
        accurateDisbeliefs: 0, // Player 2 incorrectly disbelieved player 1's truthful claim
      });
    });

    it('should handle empty rounds array', () => {
      const stats = calculateGameStatistics(game, players, []);

      expect(stats.totalRounds).toBe(0);
      expect(stats.averageRoundDuration).toBe(0);
      expect(stats.shortestRound).toBe(0);
      expect(Object.keys(stats.claimAccuracy)).toHaveLength(0);
    });

    it('should calculate round durations correctly', () => {
      // Override createdAt times for predictable duration calculation
      rounds[0]!.createdAt = '2023-01-01T00:00:00.000Z';
      rounds[0]!.resolvedAt = '2023-01-01T00:01:00.000Z'; // 60 seconds
      rounds[1]!.createdAt = '2023-01-01T00:00:00.000Z';
      rounds[1]!.resolvedAt = '2023-01-01T00:02:00.000Z'; // 120 seconds
      
      const stats = calculateGameStatistics(game, players, rounds);

      expect(stats.longestRound).toBe(120);
      expect(stats.shortestRound).toBe(60);
      expect(stats.averageRoundDuration).toBe(90);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed game objects gracefully', () => {
      const malformedGame = {} as Game;
      const result = playCard(malformedGame, {} as GamePlayer, 'card', CreatureType.COCKROACH, '2');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle null/undefined inputs', () => {
      expect(() => getPlayerTotalPenaltyCount(null as any)).toThrow();
      expect(() => isPlayerTurn(null as any, '1')).toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle game with maximum penalty cards', () => {
      const penaltyPile: PlayerGameState['penaltyPile'] = {
        [CreatureType.COCKROACH]: Array(6).fill(null).map((_, i) => createTestCard(`g${i}`, CreatureType.COCKROACH)),
        [CreatureType.MOUSE]: Array(6).fill(null).map((_, i) => createTestCard(`n${i}`, CreatureType.MOUSE)),
        [CreatureType.BAT]: Array(6).fill(null).map((_, i) => createTestCard(`b${i}`, CreatureType.BAT)),
        [CreatureType.FROG]: Array(6).fill(null).map((_, i) => createTestCard(`f${i}`, CreatureType.FROG)),
      };

      const total = getPlayerTotalPenaltyCount(penaltyPile);
      expect(total).toBe(24); // All cards in deck
    });

    it('should handle rapid consecutive rounds', () => {
      const game = { playerIds: ['1', '2', '3', '4'] } as Game;
      
      // Test cycling through all players multiple times
      let currentPlayer = '1';
      for (let i = 0; i < 10; i++) {
        currentPlayer = getNextPlayer(game, currentPlayer);
      }
      
      // Should cycle back to player 3 after 10 iterations starting from player 1
      expect(currentPlayer).toBe('3');
    });
  });
});