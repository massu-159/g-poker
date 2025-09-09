/**
 * Game Store (Zustand)
 * Central state management for game state with optimistic updates
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { Player } from '../lib/entities/Player';
import { Card } from '../lib/entities/Card';
import { Round } from '../lib/entities/Round';
import { gameService, GameWithPlayers } from '../services/gameService';
import { realtimeService } from '../services/realtimeService';
import type { GameStateChangeEvent, PlayerActionEvent, RoundUpdateEvent } from '../services/realtimeService';

// Game actions enum
export enum GameAction {
  PLAY_CARD = 'play_card',
  RESPOND_TO_CLAIM = 'respond_to_claim',
  PASS_CARD = 'pass_card',
  START_GAME = 'start_game',
  END_GAME = 'end_game'
}

// Optimistic update types
export interface OptimisticUpdate {
  id: string;
  type: GameAction;
  timestamp: string;
  playerId: string;
  data: any;
  status: 'pending' | 'confirmed' | 'failed';
}

// Connection states
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting', 
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

// Game store state interface
export interface GameStoreState {
  // Core game state
  game: GameWithPlayers | null;
  players: Player[];
  currentPlayer: Player | null;
  isPlayerTurn: boolean;
  
  // Optimistic updates
  optimisticUpdates: OptimisticUpdate[];
  pendingActions: Map<string, OptimisticUpdate>;
  
  // Connection state
  connectionStatus: ConnectionStatus;
  lastSyncTime: string | null;
  syncError: string | null;
  
  // UI state
  isLoading: boolean;
  error: string | null;
  selectedCard: Card | null;
  
  // Actions
  initializeGame: (gameId: string, playerId: string) => Promise<void>;
  playCard: (card: Card, claim: string, targetPlayerId: string) => Promise<void>;
  respondToCard: (response: 'believe' | 'disbelieve' | 'pass_back') => Promise<void>;
  startGame: () => Promise<void>;
  endGame: (winnerId?: string) => Promise<void>;
  
  // Optimistic update management
  addOptimisticUpdate: (update: Omit<OptimisticUpdate, 'id' | 'timestamp' | 'status'>) => string;
  confirmOptimisticUpdate: (updateId: string) => void;
  rejectOptimisticUpdate: (updateId: string, error: string) => void;
  rollbackOptimisticUpdate: () => void;
  
  // Server sync
  handleServerStateSync: (serverGame: GameWithPlayers) => void;
  handlePlayerAction: (event: PlayerActionEvent) => void;
  handleRoundUpdate: (event: RoundUpdateEvent) => void;
  reconcileOptimisticUpdates: () => void;
  
  // UI state management  
  setSelectedCard: (card: Card | null) => void;
  clearError: () => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  
  // Utility
  reset: () => void;
}

// Initial state
const initialState = {
  game: null,
  players: [],
  currentPlayer: null,
  isPlayerTurn: false,
  optimisticUpdates: [],
  pendingActions: new Map(),
  connectionStatus: ConnectionStatus.DISCONNECTED,
  lastSyncTime: null,
  syncError: null,
  isLoading: false,
  error: null,
  selectedCard: null,
};

export const useGameStore = create<GameStoreState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Initialize game and setup realtime subscriptions
    initializeGame: async (gameId: string, playerId: string) => {
      try {
        set({ isLoading: true, error: null });

        // Get current player data
        const playerResult = await gameService.getGameWithPlayers(gameId);
        if (!playerResult.success || !playerResult.data) {
          throw new Error(playerResult.error?.message || 'Failed to load game');
        }

        const game = playerResult.data;
        const currentPlayer = game.players?.find(p => p.id === playerId);
        
        if (!currentPlayer) {
          throw new Error('Player not found in game');
        }

        // Update state
        set({
          game,
          players: game.players || [],
          currentPlayer,
          isPlayerTurn: game.state.currentTurn === playerId,
          connectionStatus: ConnectionStatus.CONNECTED,
          lastSyncTime: new Date().toISOString(),
          isLoading: false
        });

        // Setup realtime subscriptions
        const playerAuth = { deviceId: currentPlayer.deviceId };
        
        await realtimeService.subscribeToGame(gameId, playerAuth, {
          onGameStateChange: (event: GameStateChangeEvent) => {
            get().handleServerStateSync(event.gameState as GameWithPlayers);
          },
          onPlayerAction: (event: PlayerActionEvent) => {
            get().handlePlayerAction(event);
          },
          onRoundUpdate: (event: RoundUpdateEvent) => {
            get().handleRoundUpdate(event);
          },
          onError: (error: any) => {
            set({ 
              error: error.message || 'Realtime connection error',
              connectionStatus: ConnectionStatus.ERROR 
            });
          }
        });

      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to initialize game',
          isLoading: false,
          connectionStatus: ConnectionStatus.ERROR
        });
      }
    },

    // Play a card with optimistic update
    playCard: async (card: Card, claim: string, targetPlayerId: string) => {
      const { currentPlayer, game } = get();
      
      if (!currentPlayer || !game) {
        throw new Error('No active game or player');
      }

      if (!get().isPlayerTurn) {
        throw new Error('Not your turn');
      }

      // Create optimistic update
      const updateId = get().addOptimisticUpdate({
        type: GameAction.PLAY_CARD,
        playerId: currentPlayer.id,
        data: { card, claim, targetPlayerId }
      });

      try {
        // Apply optimistic UI changes
        const newHand = currentPlayer.gameState?.hand?.filter(c => c.id !== card.id) || [];
        
        set(state => ({
          players: state.players.map(p => 
            p.id === currentPlayer.id 
              ? { 
                  ...p, 
                  gameState: { 
                    ...p.gameState!, 
                    hand: newHand 
                  } 
                }
              : p
          ),
          selectedCard: null,
          isPlayerTurn: false // Turn switches after play
        }));

        // Send to server
        const result = await gameService.recordAction(
          game.id, 
          currentPlayer.id, 
          'play_card', 
          { cardId: card.id, claim, targetPlayerId }
        );

        if (result.success) {
          get().confirmOptimisticUpdate(updateId);
        } else {
          get().rejectOptimisticUpdate(updateId, result.error?.message || 'Action failed');
        }
      } catch (error) {
        get().rejectOptimisticUpdate(updateId, error instanceof Error ? error.message : 'Action failed');
      }
    },

    // Respond to a card claim
    respondToCard: async (response: 'believe' | 'disbelieve' | 'pass_back') => {
      const { currentPlayer, game } = get();
      
      if (!currentPlayer || !game || !game.currentRound) {
        throw new Error('No active round');
      }

      try {
        // Apply optimistic changes
        set({ isPlayerTurn: false });

        const result = await gameService.recordAction(
          game.id,
          currentPlayer.id,
          'respond_to_claim',
          { response }
        );

        if (!result.success) {
          set({ error: result.error?.message || 'Response failed' });
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Response failed' });
      }
    },

    // Start the game
    startGame: async () => {
      const { game } = get();
      
      if (!game) {
        throw new Error('No game loaded');
      }

      try {
        set({ isLoading: true });
        
        const result = await gameService.startGame(game.id);
        
        if (result.success && result.data) {
          // Convert Game to GameWithPlayers by fetching players
          const gameWithPlayersResult = await gameService.getGameWithPlayers(result.data.id);
          if (gameWithPlayersResult.success && gameWithPlayersResult.data) {
            set({ 
              game: gameWithPlayersResult.data,
              players: gameWithPlayersResult.data.players,
              isLoading: false 
            });
          } else {
            set({ 
              game: { ...result.data, players: [] } as GameWithPlayers,
              isLoading: false 
            });
          }
        } else {
          set({ 
            error: result.error?.message || 'Failed to start game',
            isLoading: false 
          });
        }
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to start game',
          isLoading: false
        });
      }
    },

    // End the game
    endGame: async (winnerId?: string) => {
      const { game } = get();
      
      if (!game) {
        throw new Error('No game loaded');
      }

      try {
        const result = await gameService.endGame(game.id, winnerId);
        
        if (result.success && result.data) {
          // Convert Game to GameWithPlayers by fetching players
          const gameWithPlayersResult = await gameService.getGameWithPlayers(result.data.id);
          if (gameWithPlayersResult.success && gameWithPlayersResult.data) {
            set({ 
              game: gameWithPlayersResult.data,
              players: gameWithPlayersResult.data.players
            });
          } else {
            set({ game: { ...result.data, players: [] } as GameWithPlayers });
          }
        } else {
          set({ error: result.error?.message || 'Failed to end game' });
        }
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to end game'
        });
      }
    },

    // Optimistic update management
    addOptimisticUpdate: (update: Omit<OptimisticUpdate, 'id' | 'timestamp' | 'status'>) => {
      const id = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const optimisticUpdate: OptimisticUpdate = {
        id,
        timestamp: new Date().toISOString(),
        status: 'pending',
        ...update
      };

      set(state => ({
        optimisticUpdates: [...state.optimisticUpdates, optimisticUpdate],
        pendingActions: new Map(state.pendingActions).set(id, optimisticUpdate)
      }));

      return id;
    },

    confirmOptimisticUpdate: (updateId: string) => {
      set(state => {
        const newPendingActions = new Map(state.pendingActions);
        newPendingActions.delete(updateId);

        return {
          optimisticUpdates: state.optimisticUpdates.map(u => 
            u.id === updateId ? { ...u, status: 'confirmed' as const } : u
          ),
          pendingActions: newPendingActions
        };
      });
    },

    rejectOptimisticUpdate: (updateId: string, error: string) => {
      set(state => {
        const update = state.pendingActions.get(updateId);
        if (update) {
          // Rollback optimistic changes
          get().rollbackOptimisticUpdate();
        }

        const newPendingActions = new Map(state.pendingActions);
        newPendingActions.delete(updateId);

        return {
          optimisticUpdates: state.optimisticUpdates.map(u => 
            u.id === updateId ? { ...u, status: 'failed' as const } : u
          ),
          pendingActions: newPendingActions,
          error
        };
      });
    },

    rollbackOptimisticUpdate: () => {
      // Implementation depends on the specific action type
      // For now, trigger a server sync to restore correct state
      const { game } = get();
      if (game) {
        gameService.getGameWithPlayers(game.id).then(result => {
          if (result.success && result.data) {
            get().handleServerStateSync(result.data);
          }
        });
      }
    },

    // Server state synchronization
    handleServerStateSync: (serverGame: GameWithPlayers) => {
      const { currentPlayer } = get();
      
      set({
        game: serverGame,
        players: serverGame.players,
        isPlayerTurn: currentPlayer ? serverGame.state.currentTurn === currentPlayer.id : false,
        lastSyncTime: new Date().toISOString(),
        connectionStatus: ConnectionStatus.CONNECTED
      });

      // Reconcile optimistic updates
      get().reconcileOptimisticUpdates();
    },

    handlePlayerAction: (event: PlayerActionEvent) => {
      // Handle real-time player actions from other players
      console.log('Player action received:', event);
      
      // Trigger a state sync if the action affects current game
      const { game } = get();
      if (game && event.gameId === game.id) {
        // Fetch latest game state
        gameService.getGameWithPlayers(game.id).then(result => {
          if (result.success && result.data) {
            get().handleServerStateSync(result.data);
          }
        });
      }
    },

    handleRoundUpdate: (event: RoundUpdateEvent) => {
      // Handle round updates
      const { game } = get();
      if (game && event.gameId === game.id) {
        set(state => ({
          game: {
            ...state.game!,
            currentRound: event.round as Round
          }
        }));
      }
    },

    reconcileOptimisticUpdates: () => {
      // For now, simply clear all confirmed updates
      // In a more sophisticated implementation, you would compare timestamps
      // and determine which updates have been processed by the server
      
      set(state => ({
        optimisticUpdates: state.optimisticUpdates.filter(u => u.status === 'pending')
      }));
    },

    // UI state management
    setSelectedCard: (card: Card | null) => {
      set({ selectedCard: card });
    },

    clearError: () => {
      set({ error: null });
    },

    setConnectionStatus: (status: ConnectionStatus) => {
      set({ connectionStatus: status });
    },

    // Reset store state
    reset: () => {
      set(initialState);
    }
  }))
);

// Selectors for common state combinations
export const useGameState = () => useGameStore(state => ({
  game: state.game,
  players: state.players,
  currentPlayer: state.currentPlayer,
  isPlayerTurn: state.isPlayerTurn,
  isLoading: state.isLoading,
  error: state.error
}));

export const useGameActions = () => useGameStore(state => ({
  playCard: state.playCard,
  respondToCard: state.respondToCard,
  startGame: state.startGame,
  endGame: state.endGame,
  setSelectedCard: state.setSelectedCard,
  clearError: state.clearError
}));

export const useConnectionState = () => useGameStore(state => ({
  connectionStatus: state.connectionStatus,
  lastSyncTime: state.lastSyncTime,
  syncError: state.syncError
}));

export const useOptimisticUpdates = () => useGameStore(state => ({
  optimisticUpdates: state.optimisticUpdates,
  pendingActions: Array.from(state.pendingActions.values())
}));