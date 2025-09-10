/**
 * Environment Configuration
 * Centralized configuration for the ごきぶりポーカー app
 */

import Constants from 'expo-constants';

// Environment types
export type Environment = 'development' | 'staging' | 'production';

// App configuration interface
export interface AppConfig {
  env: Environment;
  api: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    timeout: number;
  };
  game: {
    maxPlayers: number;
    defaultTurnTimeLimit: number;
    defaultGameTimeLimit: number;
    maxHandSize: number;
    totalCardsPerType: number;
    creatureTypes: number;
  };
  ui: {
    animationDuration: {
      fast: number;
      normal: number;
      slow: number;
    };
    toastDuration: number;
    loadingTimeout: number;
  };
  debug: {
    enableLogs: boolean;
    enableAnimationDebugging: boolean;
    enableStateDebugging: boolean;
    showPerformanceMetrics: boolean;
  };
}

// Get environment from Expo Constants or process.env
const getEnvironment = (): Environment => {
  // Check Expo public environment variable first
  const expoEnv = Constants.expoConfig?.extra?.['environment'] || 
                  process.env['EXPO_PUBLIC_NODE_ENV'];
  
  if (expoEnv === 'production') return 'production';
  if (expoEnv === 'staging') return 'staging';
  return 'development';
};

// Validate required environment variables
const validateEnvVars = () => {
  const supabaseUrl = Constants.expoConfig?.extra?.['supabaseUrl'] || 
                      process.env['EXPO_PUBLIC_SUPABASE_URL'];
  const supabaseAnonKey = Constants.expoConfig?.extra?.['supabaseAnonKey'] || 
                          process.env['EXPO_PUBLIC_SUPABASE_ANON_KEY'];

  if (!supabaseUrl) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL is required');
  }

  if (!supabaseAnonKey) {
    throw new Error('EXPO_PUBLIC_SUPABASE_ANON_KEY is required');
  }

  return { supabaseUrl, supabaseAnonKey };
};

// Environment-specific configurations
const createConfig = (): AppConfig => {
  const env = getEnvironment();
  const { supabaseUrl, supabaseAnonKey } = validateEnvVars();

  const baseConfig: AppConfig = {
    env,
    api: {
      supabaseUrl,
      supabaseAnonKey,
      timeout: 10000, // 10 seconds
    },
    game: {
      maxPlayers: 2,
      defaultTurnTimeLimit: 60, // 60 seconds per turn
      defaultGameTimeLimit: 1800, // 30 minutes per game
      maxHandSize: 9,
      totalCardsPerType: 6,
      creatureTypes: 4, // ゴキブリ, ネズミ, コウモリ, カエル
    },
    ui: {
      animationDuration: {
        fast: 200,
        normal: 400,
        slow: 800,
      },
      toastDuration: 3000,
      loadingTimeout: 30000, // 30 seconds
    },
    debug: {
      enableLogs: env === 'development',
      enableAnimationDebugging: env === 'development',
      enableStateDebugging: env === 'development',
      showPerformanceMetrics: env === 'development',
    },
  };

  // Environment-specific overrides
  switch (env) {
    case 'production':
      return {
        ...baseConfig,
        api: {
          ...baseConfig.api,
          timeout: 15000, // Longer timeout in production
        },
        ui: {
          ...baseConfig.ui,
          loadingTimeout: 45000, // Longer loading timeout in production
        },
        debug: {
          enableLogs: false,
          enableAnimationDebugging: false,
          enableStateDebugging: false,
          showPerformanceMetrics: false,
        },
      };

    case 'staging':
      return {
        ...baseConfig,
        debug: {
          enableLogs: true,
          enableAnimationDebugging: false,
          enableStateDebugging: true,
          showPerformanceMetrics: true,
        },
      };

    case 'development':
    default:
      return baseConfig;
  }
};

// Export the configuration
export const config = createConfig();

// Utility functions
export const isDevelopment = () => config.env === 'development';
export const isProduction = () => config.env === 'production';
export const isStaging = () => config.env === 'staging';

// App constants
export const APP_CONSTANTS = {
  APP_NAME: 'ごきぶりポーカー',
  APP_VERSION: Constants.expoConfig?.version || '1.0.0',
  BUILD_VERSION: Constants.expoConfig?.extra?.['buildVersion'] || '1',
  
  // Game rules constants
  CREATURE_TYPES: ['ゴキブリ', 'ネズミ', 'コウモリ', 'カエル'] as const,
  CREATURE_EMOJIS: ['🪳', '🐭', '🦇', '🐸'] as const,
  
  // UI Constants
  COLORS: {
    PRIMARY: '#007AFF',
    SECONDARY: '#34C759',
    DANGER: '#FF3B30',
    WARNING: '#FF9500',
    SUCCESS: '#30D158',
    INFO: '#007AFF',
    DARK: '#1E3A5F',
    LIGHT: '#F2F2F7',
    GRAY: '#8E8E93',
  },
  
  // Animation constants
  ANIMATION_CURVES: {
    EASE_IN_OUT: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    EASE_OUT: [0.25, 1, 0.5, 1] as [number, number, number, number],
    EASE_IN: [0.5, 0, 0.75, 0] as [number, number, number, number],
  },
  
  // Storage keys
  STORAGE_KEYS: {
    USER_PROFILE: '@g-poker:user_profile',
    GAME_HISTORY: '@g-poker:game_history',
    SETTINGS: '@g-poker:settings',
    LAST_GAME_ID: '@g-poker:last_game_id',
  },
} as const;

// Type exports
export type CreatureType = typeof APP_CONSTANTS.CREATURE_TYPES[number];
export type CreatureEmoji = typeof APP_CONSTANTS.CREATURE_EMOJIS[number];
export type ColorKeys = keyof typeof APP_CONSTANTS.COLORS;

// Validation functions
export const isValidEnvironment = (env: string): env is Environment => {
  return ['development', 'staging', 'production'].includes(env);
};

export const getSupabaseConfig = () => ({
  url: config.api.supabaseUrl,
  key: config.api.supabaseAnonKey,
});

// Debug utilities
export const log = (...args: any[]) => {
  if (config.debug.enableLogs) {
    console.log('[G-POKER]', ...args);
  }
};

export const logError = (...args: any[]) => {
  if (config.debug.enableLogs) {
    console.error('[G-POKER ERROR]', ...args);
  }
};

export const logWarning = (...args: any[]) => {
  if (config.debug.enableLogs) {
    console.warn('[G-POKER WARNING]', ...args);
  }
};

// Performance monitoring
export const measurePerformance = <T>(
  label: string,
  fn: () => T
): T => {
  if (!config.debug.showPerformanceMetrics) {
    return fn();
  }

  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  console.log(`[PERFORMANCE] ${label}: ${(end - start).toFixed(2)}ms`);
  return result;
};

export default config;