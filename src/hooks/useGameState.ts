/**
 * Game State Management Hooks
 * Custom React hooks that integrate Zustand stores with components
 */

import { useMemo } from 'react';
import { useGameStore, useGameState, useGameActions, useConnectionState, useOptimisticUpdates } from '../stores/gameStore';
import { useUserStore, useAuthState, useUserProfile, useUserActions, useGameStats } from '../stores/userStore';
import { Card } from '../lib/entities/Card';
import { Player } from '../lib/entities/Player';
import { Game } from '../lib/entities/Game';

// Combined game state hook for main game screen
export const useGame = () => {
  const gameState = useGameState();
  const gameActions = useGameActions();
  const connectionState = useConnectionState();
  const authState = useAuthState();
  const selectedCard = useGameStore(state => state.selectedCard);

  // Derived state
  const isCurrentPlayerTurn = useMemo(() => {
    return gameState.currentPlayer && 
           gameState.game?.state.currentTurn === gameState.currentPlayer.id;
  }, [gameState.currentPlayer, gameState.game]);

  const opponentPlayer = useMemo(() => {
    if (!gameState.currentPlayer || !gameState.players) return null;
    return gameState.players.find(p => p.id !== gameState.currentPlayer?.id) || null;
  }, [gameState.currentPlayer, gameState.players]);

  const canPlayCard = useMemo(() => {
    return isCurrentPlayerTurn && 
           gameState.game?.status === 'in_progress' && 
           connectionState.connectionStatus === 'connected' &&
           !gameState.isLoading;
  }, [isCurrentPlayerTurn, gameState.game?.status, connectionState.connectionStatus, gameState.isLoading]);

  const currentPlayerHand = useMemo(() => {
    return gameState.currentPlayer?.gameState?.hand || [];
  }, [gameState.currentPlayer?.gameState?.hand]);

  return {
    // Game state
    game: gameState.game,
    players: gameState.players,
    currentPlayer: gameState.currentPlayer,
    opponentPlayer,
    isLoading: gameState.isLoading,
    error: gameState.error,

    // Turn state
    isCurrentPlayerTurn,
    canPlayCard,
    currentPlayerHand,

    // Connection state
    connectionStatus: connectionState.connectionStatus,
    lastSyncTime: connectionState.lastSyncTime,
    syncError: connectionState.syncError,

    // Auth state
    isAuthenticated: authState.isAuthenticated,
    
    // Actions
    playCard: gameActions.playCard,
    respondToCard: gameActions.respondToCard,
    startGame: gameActions.startGame,
    endGame: gameActions.endGame,
    setSelectedCard: gameActions.setSelectedCard,
    clearError: gameActions.clearError,

    // Selected card
    selectedCard
  };
};

// Hook for game initialization and cleanup
export const useGameInitialization = () => {
  const initializeGame = useGameStore(state => state.initializeGame);
  const reset = useGameStore(state => state.reset);
  const setConnectionStatus = useGameStore(state => state.setConnectionStatus);

  return {
    initializeGame,
    resetGameState: reset,
    setConnectionStatus
  };
};

// Hook for optimistic updates monitoring
export const useGameOptimisticUpdates = () => {
  const optimisticUpdates = useOptimisticUpdates();
  const addOptimisticUpdate = useGameStore(state => state.addOptimisticUpdate);
  const confirmOptimisticUpdate = useGameStore(state => state.confirmOptimisticUpdate);
  const rejectOptimisticUpdate = useGameStore(state => state.rejectOptimisticUpdate);

  const hasPendingUpdates = useMemo(() => {
    return optimisticUpdates.pendingActions.length > 0;
  }, [optimisticUpdates.pendingActions]);

  return {
    optimisticUpdates: optimisticUpdates.optimisticUpdates,
    pendingActions: optimisticUpdates.pendingActions,
    hasPendingUpdates,
    addOptimisticUpdate,
    confirmOptimisticUpdate,
    rejectOptimisticUpdate
  };
};

// Hook for game statistics and history
export const useGameStatistics = () => {
  const gameStats = useGameStats();
  const userProfile = useUserProfile();

  const winPercentage = useMemo(() => {
    return gameStats.totalGames > 0 ? Math.round(gameStats.winRate * 100) : 0;
  }, [gameStats.winRate, gameStats.totalGames]);

  const averageGameDurationMinutes = useMemo(() => {
    return gameStats.averageGameDuration > 0 
      ? Math.round(gameStats.averageGameDuration / 60) 
      : 0;
  }, [gameStats.averageGameDuration]);

  const recentPerformance = useMemo(() => {
    const last5Games = gameStats.recentGames.slice(0, 5);
    const wins = last5Games.filter(game => game.result === 'win').length;
    return { wins, total: last5Games.length, percentage: last5Games.length > 0 ? Math.round((wins / last5Games.length) * 100) : 0 };
  }, [gameStats.recentGames]);

  return {
    // Raw stats
    totalGames: gameStats.totalGames,
    wins: gameStats.wins,
    losses: gameStats.losses,
    winRate: gameStats.winRate,
    fastestWin: gameStats.fastestWin,
    longestGame: gameStats.longestGame,
    favoriteCreatureType: gameStats.favoriteCreatureType,
    recentGames: gameStats.recentGames,

    // Computed stats
    winPercentage,
    averageGameDurationMinutes,
    recentPerformance,

    // User profile
    preferences: userProfile.preferences,
    gameHistory: userProfile.gameHistory,

    // Actions
    addGameResult: gameStats.addGameResult
  };
};

// Hook for player management
export const usePlayerActions = () => {
  const userActions = useUserActions();
  const authState = useAuthState();

  return {
    // Authentication
    authenticateWithApple: userActions.authenticateWithApple,
    authenticateWithEmail: userActions.authenticateWithEmail,
    signUpWithEmail: userActions.signUpWithEmail,
    signOut: userActions.signOut,

    // Profile management
    updateProfile: userActions.updateProfile,
    updatePreferences: userActions.updatePreferences,

    // Current state
    currentPlayer: authState.currentPlayer,
    userId: authState.userId,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    error: authState.error,

    // Utility
    clearError: userActions.clearError
  };
};

// Hook for game validation and rules
export const useGameValidation = () => {
  const { game, currentPlayer, isCurrentPlayerTurn } = useGame();

  const validateCardPlay = (card: Card, targetPlayerId: string) => {
    if (!game || !currentPlayer) {
      return { valid: false, error: 'No active game or player' };
    }

    if (!isCurrentPlayerTurn) {
      return { valid: false, error: 'Not your turn' };
    }

    if (game.status !== 'in_progress') {
      return { valid: false, error: 'Game is not in progress' };
    }

    const playerHand = currentPlayer.gameState?.hand || [];
    if (!playerHand.find(c => c.id === card.id)) {
      return { valid: false, error: 'Card not in hand' };
    }

    const targetPlayer = game.players?.find(p => p.id === targetPlayerId);
    if (!targetPlayer) {
      return { valid: false, error: 'Invalid target player' };
    }

    if (targetPlayerId === currentPlayer.id) {
      return { valid: false, error: 'Cannot target yourself' };
    }

    return { valid: true };
  };

  const validateResponse = (response: 'believe' | 'disbelieve' | 'pass_back') => {
    if (!game || !currentPlayer) {
      return { valid: false, error: 'No active game or player' };
    }

    if (!game.currentRound) {
      return { valid: false, error: 'No active round' };
    }

    if (game.currentRound.response) {
      return { valid: false, error: 'Response already given' };
    }

    // Check if it's the target player's turn to respond
    const currentRound = game.currentRound;
    if (currentRound.cardInPlay && game.state.currentTurn !== currentPlayer.id) {
      return { valid: false, error: 'Not your turn to respond' };
    }

    return { valid: true };
  };

  const checkWinCondition = (player: Player) => {
    if (!player.gameState?.penaltyPile) return false;

    // Check if player has 3 cards of the same creature type
    for (const creatureType of Object.keys(player.gameState.penaltyPile)) {
      const cards = player.gameState.penaltyPile[creatureType as keyof typeof player.gameState.penaltyPile];
      if (cards && cards.length >= 3) {
        return true; // Player loses (has 3+ of same type)
      }
    }

    return false;
  };

  return {
    validateCardPlay,
    validateResponse,
    checkWinCondition
  };
};

// Hook for game UI state
export const useGameUI = () => {
  const selectedCard = useGameStore(state => state.selectedCard);
  const setSelectedCard = useGameStore(state => state.setSelectedCard);
  const { currentPlayerHand, canPlayCard } = useGame();

  const selectCard = (card: Card | null) => {
    if (!canPlayCard && card) {
      return; // Don't select cards when player can't play
    }
    setSelectedCard(card);
  };

  const isCardSelectable = (card: Card) => {
    return canPlayCard && currentPlayerHand.some(c => c.id === card.id);
  };

  const isCardSelected = (card: Card) => {
    return selectedCard?.id === card.id;
  };

  return {
    selectedCard,
    selectCard,
    isCardSelectable,
    isCardSelected,
    clearSelection: () => setSelectedCard(null)
  };
};