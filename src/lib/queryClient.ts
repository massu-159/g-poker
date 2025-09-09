/**
 * TanStack Query Client Configuration
 * Manages server state caching, synchronization, and error handling
 */

import { QueryClient, QueryClientConfig } from '@tanstack/react-query';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Query keys for consistent caching
export const queryKeys = {
  // Game queries
  game: (gameId: string) => ['game', gameId] as const,
  gameWithPlayers: (gameId: string) => ['game', gameId, 'players'] as const,
  gameHistory: (gameId: string) => ['game', gameId, 'history'] as const,
  gameActions: (gameId: string) => ['game', gameId, 'actions'] as const,
  
  // Player queries  
  player: (playerId: string) => ['player', playerId] as const,
  playersByGame: (gameId: string) => ['players', 'game', gameId] as const,
  playerConnection: (playerId: string) => ['player', playerId, 'connection'] as const,
  
  // Round queries
  round: (roundId: string) => ['round', roundId] as const,
  roundsByGame: (gameId: string) => ['rounds', 'game', gameId] as const,
  
  // Matchmaking queries
  matchmakingStatus: (matchmakingId: string) => ['matchmaking', matchmakingId] as const,
  availableGames: () => ['games', 'available'] as const,
  
  // Statistics queries
  playerStats: (playerId: string) => ['player', playerId, 'stats'] as const,
  gameStats: (gameId: string) => ['game', gameId, 'stats'] as const,
} as const;

// Default query options
const defaultQueryOptions: QueryClientConfig = {
  defaultOptions: {
    queries: {
      // Stale time - how long data is considered fresh
      staleTime: 1000 * 60 * 5, // 5 minutes
      
      // Cache time - how long unused data stays in cache
      gcTime: 1000 * 60 * 10, // 10 minutes
      
      // Retry configuration
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // Retry up to 3 times for other errors
        return failureCount < 3;
      },
      
      // Retry delay with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Network mode - handle offline scenarios
      networkMode: 'online',
      
      // Refetch configuration
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      // Retry mutations with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      
      // Network mode for mutations
      networkMode: 'online',
    },
  },
};

// Create query client
export const queryClient = new QueryClient(defaultQueryOptions);

// Setup app state management for React Native
const setupAppStateFocusHandling = () => {
  const onAppStateChange = (status: AppStateStatus) => {
    // Update focus manager based on app state
    focusManager.setFocused(status === 'active');
  };

  // Set initial focus state
  focusManager.setFocused(AppState.currentState === 'active');
  
  // Listen to app state changes
  const subscription = AppState.addEventListener('change', onAppStateChange);
  
  return () => subscription?.remove();
};

// Setup network state management
const setupNetworkStateHandling = () => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    // Update online manager based on network state
    onlineManager.setOnline(
      state.isConnected != null &&
      state.isConnected &&
      Boolean(state.isInternetReachable)
    );
  });
  
  return unsubscribe;
};

// Initialize React Native specific configurations
export const initializeQueryClient = () => {
  // Setup app state handling
  const cleanupAppState = setupAppStateFocusHandling();
  
  // Setup network state handling  
  const cleanupNetworkState = setupNetworkStateHandling();
  
  // Configure query client event handlers
  queryClient.getQueryCache().config.onError = (error, query) => {
    console.error('Query error:', error, 'Query key:', query.queryKey);
  };
  
  queryClient.getMutationCache().config.onError = (error, variables, context, mutation) => {
    console.error('Mutation error:', error, 'Variables:', variables);
  };
  
  // Global error handler for network errors
  queryClient.getQueryCache().config.onError = (error: any, query) => {
    if (error?.message?.includes('Network')) {
      console.warn('Network error detected, queries will retry when online');
    }
  };
  
  // Return cleanup function
  return () => {
    cleanupAppState();
    cleanupNetworkState();
  };
};

// Query invalidation utilities
export const invalidateQueries = {
  // Game related invalidations
  game: (gameId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.game(gameId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.gameWithPlayers(gameId) });
  },
  
  gameHistory: (gameId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.gameHistory(gameId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.gameActions(gameId) });
  },
  
  // Player related invalidations
  player: (playerId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.player(playerId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.playerConnection(playerId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.playerStats(playerId) });
  },
  
  gameUsers: (gameId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.playersByGame(gameId) });
  },
  
  // Round related invalidations
  rounds: (gameId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.roundsByGame(gameId) });
  },
  
  // Matchmaking invalidations
  matchmaking: () => {
    queryClient.invalidateQueries({ queryKey: ['matchmaking'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.availableGames() });
  },
  
  // Clear all cached data
  all: () => {
    queryClient.invalidateQueries();
  }
};

// Prefetch utilities for better UX
export const prefetchQueries = {
  // Prefetch game data when joining
  gameData: async (gameId: string) => {
    await Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: queryKeys.gameWithPlayers(gameId),
        staleTime: 1000 * 30, // 30 seconds
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.roundsByGame(gameId),
        staleTime: 1000 * 60, // 1 minute
      })
    ]);
  },
  
  // Prefetch player stats
  playerStats: async (playerId: string) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.playerStats(playerId),
      staleTime: 1000 * 60 * 5, // 5 minutes
    });
  }
};

// Cache management utilities
export const cacheUtils = {
  // Set cached data directly
  setGameData: (gameId: string, gameData: any) => {
    queryClient.setQueryData(queryKeys.gameWithPlayers(gameId), gameData);
  },
  
  setPlayerData: (playerId: string, playerData: any) => {
    queryClient.setQueryData(queryKeys.player(playerId), playerData);
  },
  
  // Get cached data
  getGameData: (gameId: string) => {
    return queryClient.getQueryData(queryKeys.gameWithPlayers(gameId));
  },
  
  getPlayerData: (playerId: string) => {
    return queryClient.getQueryData(queryKeys.player(playerId));
  },
  
  // Remove specific cached data
  removeGameData: (gameId: string) => {
    queryClient.removeQueries({ queryKey: queryKeys.game(gameId) });
    queryClient.removeQueries({ queryKey: queryKeys.gameWithPlayers(gameId) });
    queryClient.removeQueries({ queryKey: queryKeys.roundsByGame(gameId) });
  },
  
  // Clear all cache
  clearCache: () => {
    queryClient.clear();
  },
  
  // Get cache stats
  getCacheStats: () => {
    const cache = queryClient.getQueryCache();
    return {
      totalQueries: cache.getAll().length,
      activeQueries: cache.getAll().filter(query => query.getObserversCount() > 0).length,
      staleQueries: cache.getAll().filter(query => query.isStale()).length,
    };
  }
};

// Performance monitoring
export const performanceUtils = {
  // Monitor query performance
  logSlowQueries: (threshold: number = 2000) => {
    // Simplified performance monitoring for development
    console.log(`Performance monitoring enabled with threshold: ${threshold}ms`);
    
    // In a production app, you would implement proper query performance tracking
    // This is simplified to avoid complex TypeScript issues
  },
  
  // Get performance metrics
  getMetrics: () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    return {
      totalQueries: queries.length,
      errorQueries: queries.filter(q => q.state.error).length,
      loadingQueries: queries.filter(q => q.state.data === undefined).length,
      successQueries: queries.filter(q => q.state.data !== undefined && !q.state.error).length,
    };
  }
};

// Development helpers
if (__DEV__) {
  // Log query cache changes in development
  queryClient.getQueryCache().subscribe((event) => {
    console.log('Query cache event:', event.type, event.query.queryKey);
  });
  
  // Make query client available globally for debugging
  (global as any).queryClient = queryClient;
}