/**
 * Mock Providers for Screen Testing
 * Simplified store providers with mock data for UI testing
 */

import React, { createContext, useContext } from 'react';
import { CreatureType } from '../lib/entities/Card';
import { GameStatus } from '../lib/entities/Game';

// Mock Game Store Context
interface MockGameStore {
  currentGame: any;
  currentRound: any;
  games: any[];
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
  isLoading: boolean;
  error: string | null;
  playCard: (data: any) => Promise<void>;
  respondToRound: (data: any) => Promise<void>;
  createGame: (data: any) => Promise<any>;
  joinGame: (gameId: string) => Promise<void>;
  leaveGame: () => Promise<void>;
  forfeitGame: () => Promise<void>;
  refreshGames: () => Promise<void>;
  gameHistory: any[];
  clearCurrentGame: () => void;
}

const MockGameStoreContext = createContext<MockGameStore | null>(null);

// Mock User Store Context
interface MockUserStore {
  user: {
    id: string;
    profile?: {
      displayName: string;
    };
  } | null;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  updateGameHistory: (data: any) => void;
}

const MockUserStoreContext = createContext<MockUserStore | null>(null);

// Mock game data
const mockCurrentGame = {
  id: 'game-123',
  status: 'in_progress',
  players: [
    {
      id: 'user-123',
      profile: { displayName: 'あなた' },
      gameState: {
        hand: [
          { id: 'card-1', creatureType: CreatureType.COCKROACH, cardNumber: 1 },
          { id: 'card-2', creatureType: CreatureType.MOUSE, cardNumber: 2 },
          { id: 'card-3', creatureType: CreatureType.BAT, cardNumber: 3 },
        ],
        penaltyPile: {
          [CreatureType.COCKROACH]: [
            { id: 'penalty-1', creatureType: CreatureType.COCKROACH, cardNumber: 4 }
          ],
          [CreatureType.MOUSE]: [],
          [CreatureType.BAT]: [],
          [CreatureType.FROG]: [
            { id: 'penalty-2', creatureType: CreatureType.FROG, cardNumber: 5 },
            { id: 'penalty-3', creatureType: CreatureType.FROG, cardNumber: 6 },
          ],
        },
      },
    },
    {
      id: 'opponent-123',
      profile: { displayName: '相手プレイヤー' },
      gameState: {
        hand: [
          { id: 'opp-card-1', creatureType: CreatureType.MOUSE, cardNumber: 1 },
          { id: 'opp-card-2', creatureType: CreatureType.BAT, cardNumber: 2 },
        ],
        penaltyPile: {
          [CreatureType.COCKROACH]: [],
          [CreatureType.MOUSE]: [
            { id: 'opp-penalty-1', creatureType: CreatureType.MOUSE, cardNumber: 3 }
          ],
          [CreatureType.BAT]: [],
          [CreatureType.FROG]: [],
        },
      },
    },
  ],
  currentTurn: 'user-123',
  winnerId: null,
  createdAt: new Date().toISOString(),
  endedAt: null,
};

const mockCurrentRound = {
  id: 'round-123',
  gameId: 'game-123',
  roundNumber: 1,
  cardInPlay: {
    id: 'played-card-1',
    creatureType: CreatureType.COCKROACH,
    cardNumber: 1,
    playedBy: 'opponent-123',
    targetPlayerId: 'user-123',
    claim: CreatureType.MOUSE,
    playedAt: new Date().toISOString(),
  },
  targetPlayerId: 'user-123',
  status: 'active' as const,
  createdAt: new Date().toISOString(),
};

export const MockGameStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mockStore: MockGameStore = {
    currentGame: mockCurrentGame,
    currentRound: mockCurrentRound,
    games: [
      {
        id: 'available-1',
        status: 'waiting_for_players',
        players: [{ id: 'other-player', profile: { displayName: '待機プレイヤー' } }],
        createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      },
      {
        id: 'available-2', 
        status: 'waiting_for_players',
        players: [],
        createdAt: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
      },
    ],
    connectionStatus: 'connected',
    isLoading: false,
    error: null,
    playCard: async (data) => {
      console.log('Mock playCard:', data);
    },
    respondToRound: async (data) => {
      console.log('Mock respondToRound:', data);
    },
    createGame: async (data) => {
      console.log('Mock createGame:', data);
      return { id: 'new-game-123', ...data };
    },
    joinGame: async (gameId) => {
      console.log('Mock joinGame:', gameId);
    },
    leaveGame: async () => {
      console.log('Mock leaveGame');
    },
    forfeitGame: async () => {
      console.log('Mock forfeitGame');
    },
    refreshGames: async () => {
      console.log('Mock refreshGames');
    },
    gameHistory: [],
    clearCurrentGame: () => {
      console.log('Mock clearCurrentGame');
    },
  };

  return (
    <MockGameStoreContext.Provider value={mockStore}>
      {children}
    </MockGameStoreContext.Provider>
  );
};

export const MockUserStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const mockStore: MockUserStore = {
    user: {
      id: 'user-123',
      profile: {
        displayName: 'テストユーザー',
      },
    },
    isAuthenticated: true,
    login: async () => {
      console.log('Mock login');
    },
    updateGameHistory: (data) => {
      console.log('Mock updateGameHistory:', data);
    },
  };

  return (
    <MockUserStoreContext.Provider value={mockStore}>
      {children}
    </MockUserStoreContext.Provider>
  );
};

// Mock hook for useGameStore
export const useGameStore = (): MockGameStore => {
  const context = useContext(MockGameStoreContext);
  if (!context) {
    throw new Error('useGameStore must be used within MockGameStoreProvider');
  }
  return context;
};

// Mock hook for useUserStore  
export const useUserStore = (): MockUserStore => {
  const context = useContext(MockUserStoreContext);
  if (!context) {
    throw new Error('useUserStore must be used within MockUserStoreProvider');
  }
  return context;
};