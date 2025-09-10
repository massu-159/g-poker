/**
 * ごきぶりポーカー App
 * Root application component with all providers and navigation
 */

import React, { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';


// Services
import { supabase } from './src/services/supabase';

// Configuration
import { config, log, logError } from './src/config/environment';

// Error Boundary
import ErrorBoundary from './src/components/ErrorBoundary';

// Types
interface AppState {
  isReady: boolean;
  initializing: boolean;
  error: string | null;
}


// Configure warnings for development
if (__DEV__) {
  LogBox.ignoreLogs([
    'Warning: ...',
    // Add specific warnings to ignore in development
  ]);
}

// Create QueryClient
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
    },
    mutations: {
      retry: 1,
    },
  },
});

export default function App() {
  const [appState, setAppState] = useState<AppState>({
    isReady: false,
    initializing: true,
    error: null,
  });

  // Store initialization - these methods may not exist yet
  // const initializeStores = useGameStore(state => state.initialize);
  // const initializeUserStore = useUserStore(state => state.initialize);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      log('Initializing app...');
      
      // Initialize Supabase connection
      await initializeSupabase();

      // Initialize stores if methods exist
      // await Promise.all([
      //   initializeStores?.(),
      //   initializeUserStore?.(),
      // ]);

      // Setup global error handlers
      setupErrorHandlers();

      log('App initialization completed');
      
      setAppState({
        isReady: true,
        initializing: false,
        error: null,
      });

      // Hide splash screen would be here

    } catch (error) {
      logError('App initialization failed:', error);
      
      setAppState({
        isReady: false,
        initializing: false,
        error: error instanceof Error ? error.message : 'Unknown initialization error',
      });

      // Still hide splash screen even if initialization fails would be here
    }
  };


  const initializeSupabase = async () => {
    try {
      // Test Supabase connection
      const { error } = await supabase
        .from('games')
        .select('id')
        .limit(1);

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
        throw error;
      }

      log('Supabase connection established');
    } catch (error) {
      logError('Supabase initialization failed:', error);
      // Don't throw - app can still work with offline functionality
    }
  };

  const setupErrorHandlers = () => {
    // Global error handler for React errors
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (config.debug.enableLogs) {
        originalConsoleError(...args);
      }
      
      // Log to crash reporting service in production
      if (config.env === 'production') {
        // TODO: Send to crash reporting service
      }
    };

    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      logError('Unhandled promise rejection:', event.reason);
      
      if (config.env === 'production') {
        // TODO: Send to crash reporting service
      }
    };

    // Handle JavaScript errors
    const handleError = (event: ErrorEvent) => {
      logError('JavaScript error:', event.error);
      
      if (config.env === 'production') {
        // TODO: Send to crash reporting service
      }
    };

    // Add event listeners for error handling
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', handleUnhandledRejection);
      window.addEventListener('error', handleError);
    }
  };

  const handleRetryInitialization = () => {
    setAppState({
      isReady: false,
      initializing: true,
      error: null,
    });
    initializeApp();
  };

  // Show initialization error
  if (appState.error && !appState.isReady) {
    return (
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ErrorBoundary
            error={new Error(appState.error)}
            onRetry={handleRetryInitialization}
          />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    );
  }

  // Show loading while initializing
  if (appState.initializing) {
    // Return null while splash screen is shown
    return null;
  }

  // Main app render
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AppNavigator />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}