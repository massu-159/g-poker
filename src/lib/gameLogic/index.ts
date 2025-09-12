/**
 * Game Logic Utilities
 * Core game mechanics and business logic for ごきぶりポーカー
 */

import { 
  Card, 
  CreatureType, 
  createFullDeck, 
  shuffleDeck, 
  dealCards, 
  checkLoseCondition,
  findCardById,
  createCardInPlay
} from '../entities/Card';
import { 
  Game, 
  GameStatus, 
  GameSettings, 
  createDefaultGameState,
  canStartGame,
  isGameActive,
  isGameFinished
} from '../entities/Game';
import { 
  Player, 
  GamePlayer, 
  PlayerGameState,
  hasPlayerLost,
  canPlayerPlay,
  createDefaultPenaltyPile
} from '../entities/Player';
import { 
  Round, 
  RoundResponse, 
  createRound, 
  createPassBackRound, 
  resolveRound, 
  addResponseToRound,
  isRoundActive
} from '../entities/Round';

// Game initialization logic
export interface GameInitializationResult {
  success: boolean;
  data?: {
    game: Game;
    players: GamePlayer[];
    initialRound?: Round;
  };
  error?: {
    code: string;
    message: string;
  };
}

export const initializeGame = (
  gameId: string,
  player1: Player,
  player2: Player,
  settings: GameSettings
): GameInitializationResult => {
  try {
    // Validate players
    if (player1.id === player2.id) {
      return {
        success: false,
        error: {
          code: 'DUPLICATE_PLAYERS',
          message: 'Cannot have the same player twice'
        }
      };
    }

    // Create and shuffle deck
    const fullDeck = createFullDeck();
    const { player1Hand, player2Hand, remainingCards } = dealCards(fullDeck);
    
    // Randomly determine first player
    const firstPlayerIndex = Math.floor(Math.random() * 2);
    const firstPlayerId = firstPlayerIndex === 0 ? player1.id : player2.id;
    
    // Create game players with initial state
    const gamePlayer1: GamePlayer = {
      ...player1,
      gameId,
      gameState: {
        hand: player1Hand,
        penaltyPile: createDefaultPenaltyPile(),
        turnPosition: 0,
        isReady: true,
        score: 0,
        hasLost: false
      },
      joinedAt: new Date().toISOString()
    };
    
    const gamePlayer2: GamePlayer = {
      ...player2,
      gameId,
      gameState: {
        hand: player2Hand,
        penaltyPile: createDefaultPenaltyPile(),
        turnPosition: 1,
        isReady: true,
        score: 0,
        hasLost: false
      },
      joinedAt: new Date().toISOString()
    };
    
    // Create game
    const game: Game = {
      id: gameId,
      status: 'in_progress',
      settings,
      state: createDefaultGameState(firstPlayerId),
      playerIds: [player1.id, player2.id],
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      createdBy: player1.id, // Assume player1 created the game
      version: 1,
      
      // Computed properties
      playersCount: 2,
      isActive: true,
      canJoin: false
    };
    
    return {
      success: true,
      data: {
        game,
        players: [gamePlayer1, gamePlayer2]
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'INITIALIZATION_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error during game initialization'
      }
    };
  }
};

// Card playing logic
export interface PlayCardResult {
  success: boolean;
  data?: {
    newRound: Round;
    updatedGame: Game;
    updatedPlayer: GamePlayer;
  };
  error?: {
    code: string;
    message: string;
  };
}

export const playCard = (
  game: Game,
  player: GamePlayer,
  cardId: string,
  claim: CreatureType,
  targetPlayerId: string
): PlayCardResult => {
  try {
    // Validate game state
    if (!isGameActive(game)) {
      return {
        success: false,
        error: {
          code: 'GAME_NOT_ACTIVE',
          message: 'Game is not currently active'
        }
      };
    }
    
    // Validate it's player's turn
    if (game.state.currentTurn !== player.id) {
      return {
        success: false,
        error: {
          code: 'NOT_PLAYER_TURN',
          message: 'It is not your turn'
        }
      };
    }
    
    // Validate player can play
    if (!canPlayerPlay(player, game.state.currentTurn)) {
      return {
        success: false,
        error: {
          code: 'PLAYER_CANNOT_PLAY',
          message: 'Player cannot play at this time'
        }
      };
    }
    
    // Validate target player
    if (!game.playerIds.includes(targetPlayerId)) {
      return {
        success: false,
        error: {
          code: 'INVALID_TARGET_PLAYER',
          message: 'Target player is not in this game'
        }
      };
    }
    
    if (targetPlayerId === player.id) {
      return {
        success: false,
        error: {
          code: 'CANNOT_TARGET_SELF',
          message: 'Cannot target yourself'
        }
      };
    }
    
    // Find card in player's hand
    const card = findCardById(player.gameState.hand, cardId);
    if (!card) {
      return {
        success: false,
        error: {
          code: 'CARD_NOT_IN_HAND',
          message: 'Card not found in player hand'
        }
      };
    }
    
    // Create card in play
    const cardInPlay = createCardInPlay(card, player.id, claim, targetPlayerId);
    
    // Create new round
    const newRound = createRound({
      gameId: game.id,
      cardInPlay,
      targetPlayerId,
      turnTimeLimit: game.settings.turnTimeLimit
    });
    
    // Remove card from player's hand
    const updatedHand = player.gameState.hand.filter(c => c.id !== cardId);
    const updatedPlayer: GamePlayer = {
      ...player,
      gameState: {
        ...player.gameState,
        hand: updatedHand
      }
    };
    
    // Update game with new round and turn
    const updatedGame: Game = {
      ...game,
      state: {
        ...game.state,
        currentTurn: targetPlayerId, // Now it's target player's turn to respond
        turnStartedAt: new Date().toISOString(),
        lastAction: {
          type: 'play_card',
          playerId: player.id,
          timestamp: new Date().toISOString(),
          data: { cardId, claim, targetPlayerId }
        }
      },
      currentRound: newRound,
      version: game.version + 1
    };
    
    return {
      success: true,
      data: {
        newRound,
        updatedGame,
        updatedPlayer
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'PLAY_CARD_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error playing card'
      }
    };
  }
};

// Round response logic
export interface RoundResponseResult {
  success: boolean;
  data?: {
    updatedRound: Round;
    updatedGame: Game;
    updatedPlayers: GamePlayer[];
    gameEnded?: boolean;
    winner?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export const respondToRound = (
  game: Game,
  players: GamePlayer[],
  round: Round,
  playerId: string,
  response: RoundResponse
): RoundResponseResult => {
  try {
    // Validate round is active
    if (!isRoundActive(round)) {
      return {
        success: false,
        error: {
          code: 'ROUND_NOT_ACTIVE',
          message: 'Round is not active'
        }
      };
    }
    
    // Validate player can respond
    if (round.targetPlayerId !== playerId) {
      return {
        success: false,
        error: {
          code: 'NOT_TARGET_PLAYER',
          message: 'Only the target player can respond to this round'
        }
      };
    }
    
    // Find responding player
    const respondingPlayer = players.find(p => p.id === playerId);
    if (!respondingPlayer) {
      return {
        success: false,
        error: {
          code: 'PLAYER_NOT_FOUND',
          message: 'Responding player not found'
        }
      };
    }
    
    // Add response to round
    const updatedRound = addResponseToRound(round, {
      type: response,
      respondedBy: playerId
    });
    
    let updatedGame = { ...game };
    let updatedPlayers = [...players];
    let gameEnded = false;
    let winner: string | undefined;
    
    if (response === 'pass_back') {
      // Card is passed back - create new round with roles reversed
      const nextRound = createPassBackRound(updatedRound, round.roundNumber + 1);
      
      updatedGame = {
        ...game,
        currentRound: nextRound,
        state: {
          ...game.state,
          currentTurn: nextRound.targetPlayerId,
          turnStartedAt: new Date().toISOString(),
          lastAction: {
            type: 'pass_back',
            playerId,
            timestamp: new Date().toISOString(),
            data: { originalRoundId: round.id }
          }
        },
        version: game.version + 1
      };
      
    } else {
      // Round resolved with believe/disbelieve
      if (!updatedRound.resolution) {
        throw new Error('Round resolution not created');
      }
      
      const { resolution } = updatedRound;
      const losingPlayer = updatedPlayers.find(p => p.id === resolution.loser);
      
      if (!losingPlayer) {
        throw new Error('Losing player not found');
      }
      
      // Add penalty card to losing player's pile
      const penaltyCard = resolution.penaltyCard;
      const updatedPenaltyPile = {
        ...losingPlayer.gameState.penaltyPile,
        [penaltyCard.creatureType]: [
          ...losingPlayer.gameState.penaltyPile[penaltyCard.creatureType],
          penaltyCard
        ]
      };
      
      // Update losing player
      const losingPlayerIndex = updatedPlayers.findIndex(p => p.id === resolution.loser);
      updatedPlayers[losingPlayerIndex] = {
        ...losingPlayer,
        gameState: {
          ...losingPlayer.gameState,
          penaltyPile: updatedPenaltyPile,
          score: getPlayerTotalPenaltyCount(updatedPenaltyPile),
          hasLost: checkLoseCondition(
            Object.values(updatedPenaltyPile).flat(), 
            game.settings.winCondition
          ) !== null
        }
      };
      
      // Check if game ended
      const losingPlayerUpdated = updatedPlayers[losingPlayerIndex];
      if (losingPlayerUpdated.gameState.hasLost) {
        gameEnded = true;
        winner = resolution.winner;
        
        updatedGame = {
          ...game,
          status: 'ended',
          winnerId: winner,
          endedAt: new Date().toISOString(),
          currentRound: updatedRound,
          state: {
            ...game.state,
            lastAction: {
              type: 'game_ended',
              playerId: winner,
              timestamp: new Date().toISOString(),
              data: { reason: 'penalty_limit_reached', loser: resolution.loser }
            }
          },
          version: game.version + 1
        };
      } else {
        // Game continues - winner's turn
        updatedGame = {
          ...game,
          currentRound: updatedRound,
          state: {
            ...game.state,
            currentTurn: resolution.winner,
            turnStartedAt: new Date().toISOString(),
            lastAction: {
              type: 'round_resolved',
              playerId: resolution.winner,
              timestamp: new Date().toISOString(),
              data: { 
                roundId: round.id, 
                response, 
                wasClaimTruthful: resolution.wasClaimTruthful,
                penaltyReceiver: resolution.loser 
              }
            }
          },
          version: game.version + 1
        };
      }
    }
    
    return {
      success: true,
      data: {
        updatedRound,
        updatedGame,
        updatedPlayers,
        gameEnded,
        ...(winner && { winner })
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'ROUND_RESPONSE_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error responding to round'
      }
    };
  }
};

// Helper functions
export const getPlayerTotalPenaltyCount = (penaltyPile: PlayerGameState['penaltyPile']): number => {
  return Object.values(penaltyPile).reduce((total, pile) => total + pile.length, 0);
};

export const getNextPlayer = (game: Game, currentPlayerId: string): string => {
  const currentIndex = game.playerIds.indexOf(currentPlayerId);
  const nextIndex = (currentIndex + 1) % game.playerIds.length;
  const nextPlayer = game.playerIds[nextIndex];
  if (!nextPlayer) {
    throw new Error('Invalid game state: no next player found');
  }
  return nextPlayer;
};

export const isPlayerTurn = (game: Game, playerId: string): boolean => {
  return game.state.currentTurn === playerId;
};

// Game state validation
export const validateGameState = (game: Game, players: GamePlayer[]): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  // Check player count
  if (players.length !== game.playersCount) {
    errors.push(`Player count mismatch: expected ${game.playersCount}, got ${players.length}`);
  }
  
  // Check all player IDs exist in game
  for (const playerId of game.playerIds) {
    if (!players.find(p => p.id === playerId)) {
      errors.push(`Player ${playerId} not found in players array`);
    }
  }
  
  // Check current turn player exists
  if (!players.find(p => p.id === game.state.currentTurn)) {
    errors.push(`Current turn player ${game.state.currentTurn} not found`);
  }
  
  // Check for lose conditions
  for (const player of players) {
    if (player.gameState) {
      const loseCondition = checkLoseCondition(
        Object.values(player.gameState.penaltyPile).flat(),
        game.settings.winCondition
      );
      
      if (loseCondition && game.status === 'in_progress') {
        errors.push(`Player ${player.id} should have lost but game is still in progress`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// Game statistics
export interface GameStatistics {
  totalRounds: number;
  averageRoundDuration: number;
  longestRound: number;
  shortestRound: number;
  claimAccuracy: Record<string, { total: number; truthful: number }>;
  playerPerformance: Record<string, {
    roundsWon: number;
    roundsLost: number;
    cardsPlayed: number;
    accurateBeliefs: number;
    accurateDisbeliefs: number;
  }>;
}

export const calculateGameStatistics = (
  game: Game,
  players: GamePlayer[],
  rounds: Round[]
): GameStatistics => {
  const stats: GameStatistics = {
    totalRounds: rounds.length,
    averageRoundDuration: 0,
    longestRound: 0,
    shortestRound: Number.MAX_SAFE_INTEGER,
    claimAccuracy: {},
    playerPerformance: {}
  };
  
  // Initialize player performance
  players.forEach(player => {
    stats.playerPerformance[player.id] = {
      roundsWon: 0,
      roundsLost: 0,
      cardsPlayed: 0,
      accurateBeliefs: 0,
      accurateDisbeliefs: 0
    };
  });
  
  let totalDuration = 0;
  
  rounds.forEach(round => {
    if (round.resolution && round.resolvedAt) {
      const duration = new Date(round.resolvedAt).getTime() - new Date(round.createdAt).getTime();
      const durationSeconds = duration / 1000;
      
      totalDuration += durationSeconds;
      stats.longestRound = Math.max(stats.longestRound, durationSeconds);
      stats.shortestRound = Math.min(stats.shortestRound, durationSeconds);
      
      // Update player performance
      const winner = round.resolution.winner;
      const loser = round.resolution.loser;
      
      if (stats.playerPerformance[winner]) {
        stats.playerPerformance[winner].roundsWon++;
      }
      
      if (stats.playerPerformance[loser]) {
        stats.playerPerformance[loser].roundsLost++;
      }
      
      // Track claim accuracy
      const playerId = round.cardInPlay.playedBy;
      const claim = round.cardInPlay.claim;
      
      if (!stats.claimAccuracy[playerId]) {
        stats.claimAccuracy[playerId] = { total: 0, truthful: 0 };
      }
      
      stats.claimAccuracy[playerId].total++;
      if (round.resolution.wasClaimTruthful) {
        stats.claimAccuracy[playerId].truthful++;
      }
      
      // Track response accuracy
      if (round.response && round.response.type !== 'pass_back') {
        const responderId = round.response.respondedBy;
        if (stats.playerPerformance[responderId]) {
          if (round.response.type === 'believe' && round.resolution.wasClaimTruthful) {
            stats.playerPerformance[responderId].accurateBeliefs++;
          } else if (round.response.type === 'disbelieve' && !round.resolution.wasClaimTruthful) {
            stats.playerPerformance[responderId].accurateDisbeliefs++;
          }
        }
      }
    }
    
    // Count cards played
    const playerId = round.cardInPlay.playedBy;
    if (stats.playerPerformance[playerId]) {
      stats.playerPerformance[playerId].cardsPlayed++;
    }
  });
  
  if (rounds.length > 0) {
    stats.averageRoundDuration = totalDuration / rounds.length;
  }
  
  if (stats.shortestRound === Number.MAX_SAFE_INTEGER) {
    stats.shortestRound = 0;
  }
  
  return stats;
};