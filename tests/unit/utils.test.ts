/**
 * Unit Tests for Utility Functions
 * Tests for utility helper functions and validation logic
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock console methods for testing
const mockConsole = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Utility function tests without external dependencies
describe('Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Query Key Generation', () => {
    it('should generate consistent query keys', () => {
      // Test query key generation patterns
      const generateQueryKey = (type: string, id: string, ...parts: string[]) => 
        [type, id, ...parts] as const;

      expect(generateQueryKey('game', 'game123')).toEqual(['game', 'game123']);
      expect(generateQueryKey('game', 'game456', 'players')).toEqual(['game', 'game456', 'players']);
      expect(generateQueryKey('player', 'player123', 'stats')).toEqual(['player', 'player123', 'stats']);
    });

    it('should handle empty and special character IDs', () => {
      const generateQueryKey = (type: string, id: string) => [type, id] as const;

      expect(generateQueryKey('game', '')).toEqual(['game', '']);
      expect(generateQueryKey('player', 'player-123_test@domain.com')).toEqual(['player', 'player-123_test@domain.com']);
      expect(generateQueryKey('round', 'round_456-test')).toEqual(['round', 'round_456-test']);
    });
  });

  describe('Environment Validation', () => {
    const isValidEnvironment = (env: string): boolean => {
      return ['development', 'staging', 'production'].includes(env);
    };

    it('should validate correct environment strings', () => {
      expect(isValidEnvironment('development')).toBe(true);
      expect(isValidEnvironment('staging')).toBe(true);
      expect(isValidEnvironment('production')).toBe(true);
    });

    it('should reject invalid environment strings', () => {
      expect(isValidEnvironment('invalid')).toBe(false);
      expect(isValidEnvironment('')).toBe(false);
      expect(isValidEnvironment('dev')).toBe(false);
      expect(isValidEnvironment('prod')).toBe(false);
    });

    it('should handle null and undefined values', () => {
      expect(isValidEnvironment(null as any)).toBe(false);
      expect(isValidEnvironment(undefined as any)).toBe(false);
    });

    it('should handle non-string values', () => {
      expect(isValidEnvironment(123 as any)).toBe(false);
      expect(isValidEnvironment(true as any)).toBe(false);
      expect(isValidEnvironment({} as any)).toBe(false);
      expect(isValidEnvironment([] as any)).toBe(false);
    });
  });

  describe('Logging Utilities', () => {
    const createLogger = (prefix: string, enabled: boolean) => ({
      log: (...args: any[]) => {
        if (enabled) mockConsole.log(prefix, ...args);
      },
      error: (...args: any[]) => {
        if (enabled) mockConsole.error(prefix, ...args);
      },
      warn: (...args: any[]) => {
        if (enabled) mockConsole.warn(prefix, ...args);
      },
    });

    it('should log when enabled', () => {
      const logger = createLogger('[TEST]', true);
      
      logger.log('test message', { data: 'value' });
      logger.error('error message', new Error('test'));
      logger.warn('warning message');

      expect(mockConsole.log).toHaveBeenCalledWith('[TEST]', 'test message', { data: 'value' });
      expect(mockConsole.error).toHaveBeenCalledWith('[TEST]', 'error message', new Error('test'));
      expect(mockConsole.warn).toHaveBeenCalledWith('[TEST]', 'warning message');
    });

    it('should not log when disabled', () => {
      const logger = createLogger('[TEST]', false);
      
      logger.log('test message');
      logger.error('error message');
      logger.warn('warning message');

      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });
  });

  describe('Performance Measurement', () => {
    const measurePerformance = <T>(
      label: string,
      fn: () => T,
      enabled: boolean = true
    ): T => {
      if (!enabled) {
        return fn();
      }

      const start = Date.now();
      const result = fn();
      const end = Date.now();
      
      mockConsole.log(`[PERFORMANCE] ${label}: ${(end - start).toFixed(2)}ms`);
      return result;
    };

    it('should measure and log performance when enabled', () => {
      const testFunction = jest.fn(() => 'result');
      
      // Mock Date.now to control timing
      const originalDateNow = Date.now;
      const mockDateNow = jest.fn()
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1150);
      Date.now = mockDateNow as any;

      const result = measurePerformance('test operation', testFunction, true);

      expect(result).toBe('result');
      expect(testFunction).toHaveBeenCalled();
      expect(mockConsole.log).toHaveBeenCalledWith('[PERFORMANCE] test operation: 150.00ms');

      // Restore Date.now
      Date.now = originalDateNow;
    });

    it('should not measure when disabled', () => {
      const testFunction = jest.fn(() => 'result');
      const result = measurePerformance('test operation', testFunction, false);

      expect(result).toBe('result');
      expect(testFunction).toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it('should handle functions that throw errors', () => {
      const errorFunction = jest.fn(() => {
        throw new Error('test error');
      });

      expect(() => measurePerformance('error operation', errorFunction, true))
        .toThrow('test error');
      expect(errorFunction).toHaveBeenCalled();
    });
  });

  describe('Data Validation', () => {
    const validateCreatureType = (type: any): boolean => {
      const validTypes = ['ゴキブリ', 'ネズミ', 'コウモリ', 'カエル'];
      return typeof type === 'string' && validTypes.includes(type);
    };

    it('should validate creature types', () => {
      expect(validateCreatureType('ゴキブリ')).toBe(true);
      expect(validateCreatureType('ネズミ')).toBe(true);
      expect(validateCreatureType('コウモリ')).toBe(true);
      expect(validateCreatureType('カエル')).toBe(true);
    });

    it('should reject invalid creature types', () => {
      expect(validateCreatureType('invalid')).toBe(false);
      expect(validateCreatureType('')).toBe(false);
      expect(validateCreatureType(null)).toBe(false);
      expect(validateCreatureType(undefined)).toBe(false);
      expect(validateCreatureType(123)).toBe(false);
    });

    const validateGameSettings = (settings: any): boolean => {
      return Boolean(
        settings &&
        typeof settings === 'object' &&
        typeof settings.maxPlayers === 'number' &&
        settings.maxPlayers > 0 &&
        settings.maxPlayers <= 6 &&
        typeof settings.maxHandSize === 'number' &&
        settings.maxHandSize > 0 &&
        settings.maxHandSize <= 15
      );
    };

    it('should validate game settings', () => {
      expect(validateGameSettings({
        maxPlayers: 2,
        maxHandSize: 9,
      })).toBe(true);

      expect(validateGameSettings({
        maxPlayers: 4,
        maxHandSize: 12,
      })).toBe(true);
    });

    it('should reject invalid game settings', () => {
      expect(validateGameSettings(null)).toBe(false);
      expect(validateGameSettings({})).toBe(false);
      expect(validateGameSettings({ maxPlayers: 0 })).toBe(false);
      expect(validateGameSettings({ maxPlayers: 10 })).toBe(false);
      expect(validateGameSettings({ maxPlayers: 2, maxHandSize: 0 })).toBe(false);
      expect(validateGameSettings({ maxPlayers: 2, maxHandSize: 20 })).toBe(false);
    });
  });

  describe('String Utilities', () => {
    const truncateString = (str: string, maxLength: number): string => {
      if (str.length <= maxLength) return str;
      return str.slice(0, maxLength - 3) + '...';
    };

    it('should truncate long strings', () => {
      expect(truncateString('This is a very long string', 10)).toBe('This is...');
      expect(truncateString('Short', 10)).toBe('Short');
      expect(truncateString('Exactly10!', 10)).toBe('Exactly10!');
    });

    it('should handle edge cases', () => {
      expect(truncateString('', 5)).toBe('');
      expect(truncateString('abc', 3)).toBe('abc');
      expect(truncateString('abcd', 3)).toBe('...');
    });

    const sanitizeId = (id: string): string => {
      return id.replace(/[^a-zA-Z0-9\-_]/g, '_').toLowerCase();
    };

    it('should sanitize IDs', () => {
      expect(sanitizeId('Test ID 123!')).toBe('test_id_123_');
      expect(sanitizeId('valid-id_123')).toBe('valid-id_123');
      expect(sanitizeId('Special@#$%Characters')).toBe('special____characters');
    });
  });

  describe('Array Utilities', () => {
    const shuffleArray = <T>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = shuffled[i]!;
        shuffled[i] = shuffled[j]!;
        shuffled[j] = temp;
      }
      return shuffled;
    };

    it('should shuffle arrays while preserving elements', () => {
      const original = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(original);
      
      expect(shuffled).toHaveLength(original.length);
      expect(shuffled.sort()).toEqual(original.sort());
      // Note: We can't test randomness deterministically
    });

    it('should handle empty and single-element arrays', () => {
      expect(shuffleArray([])).toEqual([]);
      expect(shuffleArray([1])).toEqual([1]);
    });

    const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
      }
      return chunks;
    };

    it('should chunk arrays correctly', () => {
      expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
      expect(chunkArray([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
      expect(chunkArray([], 2)).toEqual([]);
      expect(chunkArray([1, 2, 3], 5)).toEqual([[1, 2, 3]]);
    });
  });

  describe('Object Utilities', () => {
    const deepClone = <T>(obj: T): T => {
      if (obj === null || obj === undefined) {
        return obj;
      }
      return JSON.parse(JSON.stringify(obj));
    };

    it('should deep clone objects', () => {
      const original = {
        id: 'test',
        nested: { value: 42, array: [1, 2, 3] },
        date: '2024-01-01',
      };
      
      const cloned = deepClone(original);
      
      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.nested).not.toBe(original.nested);
      expect(cloned.nested.array).not.toBe(original.nested.array);
    });

    it('should handle null and undefined', () => {
      expect(deepClone(null)).toBeNull();
      expect(deepClone(undefined)).toBeUndefined();
    });

    const omitKeys = <T extends Record<string, any>, K extends keyof T>(
      obj: T,
      keys: K[]
    ): Omit<T, K> => {
      const result = { ...obj };
      keys.forEach(key => delete result[key]);
      return result;
    };

    it('should omit specified keys', () => {
      const obj = { id: '1', name: 'test', age: 30, email: 'test@example.com' };
      const result = omitKeys(obj, ['age', 'email']);
      
      expect(result).toEqual({ id: '1', name: 'test' });
      expect('age' in result).toBe(false);
      expect('email' in result).toBe(false);
    });
  });

  describe('Time Utilities', () => {
    const formatDuration = (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      } else {
        return `${seconds}s`;
      }
    };

    it('should format durations correctly', () => {
      expect(formatDuration(1000)).toBe('1s');
      expect(formatDuration(65000)).toBe('1m 5s');
      expect(formatDuration(3661000)).toBe('1h 1m 1s');
      expect(formatDuration(500)).toBe('0s');
    });

    const isTimeoutExpired = (startTime: number, timeout: number): boolean => {
      return Date.now() - startTime > timeout;
    };

    it('should check timeout expiration', () => {
      const now = Date.now();
      
      expect(isTimeoutExpired(now - 5000, 3000)).toBe(true);
      expect(isTimeoutExpired(now - 1000, 3000)).toBe(false);
      expect(isTimeoutExpired(now, 1000)).toBe(false);
    });
  });

  describe('Error Handling Utilities', () => {
    const safeJsonParse = (json: string, defaultValue: any = null): any => {
      try {
        return JSON.parse(json);
      } catch {
        return defaultValue;
      }
    };

    it('should safely parse JSON', () => {
      expect(safeJsonParse('{"valid": "json"}')).toEqual({ valid: 'json' });
      expect(safeJsonParse('invalid json')).toBeNull();
      expect(safeJsonParse('invalid json', { default: true })).toEqual({ default: true });
    });

    const extractErrorMessage = (error: any): string => {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      if (error?.message) return String(error.message);
      return 'Unknown error';
    };

    it('should extract error messages', () => {
      expect(extractErrorMessage(new Error('Test error'))).toBe('Test error');
      expect(extractErrorMessage('String error')).toBe('String error');
      expect(extractErrorMessage({ message: 'Object error' })).toBe('Object error');
      expect(extractErrorMessage(null)).toBe('Unknown error');
      expect(extractErrorMessage(undefined)).toBe('Unknown error');
      expect(extractErrorMessage(123)).toBe('Unknown error');
    });
  });
});

describe('Constants and Configuration', () => {
  describe('App Constants', () => {
    const APP_CONSTANTS = {
      CREATURE_TYPES: ['ゴキブリ', 'ネズミ', 'コウモリ', 'カエル'] as const,
      CREATURE_EMOJIS: ['🪳', '🐭', '🦇', '🐸'] as const,
      COLORS: {
        PRIMARY: '#007AFF',
        SECONDARY: '#34C759',
        DANGER: '#FF3B30',
        WARNING: '#FF9500',
      },
      STORAGE_KEYS: {
        USER_PROFILE: '@g-poker:user_profile',
        GAME_HISTORY: '@g-poker:game_history',
        SETTINGS: '@g-poker:settings',
      },
    } as const;

    it('should have consistent creature types and emojis', () => {
      expect(APP_CONSTANTS.CREATURE_TYPES.length).toBe(APP_CONSTANTS.CREATURE_EMOJIS.length);
      expect(APP_CONSTANTS.CREATURE_TYPES.length).toBe(4);
    });

    it('should have valid hex colors', () => {
      const hexColorRegex = /^#[0-9A-F]{6}$/i;
      Object.values(APP_CONSTANTS.COLORS).forEach(color => {
        expect(color).toMatch(hexColorRegex);
      });
    });

    it('should have valid storage key format', () => {
      const storageKeyRegex = /^@g-poker:[a-z_]+$/;
      Object.values(APP_CONSTANTS.STORAGE_KEYS).forEach(key => {
        expect(key).toMatch(storageKeyRegex);
      });
    });
  });

  describe('Configuration Validation', () => {
    const validateConfig = (config: any): boolean => {
      return Boolean(
        config &&
        typeof config === 'object' &&
        config.game &&
        typeof config.game.maxPlayers === 'number' &&
        typeof config.game.creatureTypes === 'number' &&
        config.ui &&
        typeof config.ui.animationDuration === 'object' &&
        config.debug &&
        typeof config.debug.enableLogs === 'boolean'
      );
    };

    it('should validate configuration structure', () => {
      const validConfig = {
        game: {
          maxPlayers: 2,
          creatureTypes: 4,
        },
        ui: {
          animationDuration: {
            fast: 200,
            normal: 400,
          },
        },
        debug: {
          enableLogs: true,
        },
      };

      expect(validateConfig(validConfig)).toBe(true);
      expect(validateConfig({})).toBe(false);
      expect(validateConfig(null)).toBe(false);
    });
  });
});