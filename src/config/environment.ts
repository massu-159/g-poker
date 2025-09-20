/**
 * Enterprise Environment Configuration
 * Contains all security-sensitive configuration with proper validation
 */

import { z } from 'zod';
import Constants from 'expo-constants';

// Environment schema for runtime validation
const environmentSchema = z.object({
  // Supabase Configuration
  supabaseUrl: z.string().url('Invalid Supabase URL'),
  supabaseAnonKey: z.string().min(1, 'Supabase anon key is required'),

  // App Configuration
  nodeEnv: z.enum(['development', 'staging', 'production']).default('development'),

  // Security Configuration
  enableLogging: z.boolean().default(true),
  enableAuditLogging: z.boolean().default(true),
  maxRetryAttempts: z.number().default(3),
  sessionTimeoutMs: z.number().default(30 * 60 * 1000), // 30 minutes

  // API Configuration
  apiTimeoutMs: z.number().default(10000), // 10 seconds
  maxConcurrentRequests: z.number().default(10),
});

type Environment = z.infer<typeof environmentSchema>;

// Get configuration from Expo constants or environment variables
const getRawConfig = (): Partial<Environment> => {
  const extra = Constants.expoConfig?.extra || {};

  return {
    // Supabase configuration
    supabaseUrl: extra.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: extra.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,

    // Environment configuration
    nodeEnv: (extra.nodeEnv || process.env.NODE_ENV || 'development') as Environment['nodeEnv'],

    // Security configuration
    enableLogging: extra.enableLogging !== false,
    enableAuditLogging: extra.enableAuditLogging !== false,
    maxRetryAttempts: extra.maxRetryAttempts || 3,
    sessionTimeoutMs: extra.sessionTimeoutMs || (30 * 60 * 1000),

    // API configuration
    apiTimeoutMs: extra.apiTimeoutMs || 10000,
    maxConcurrentRequests: extra.maxConcurrentRequests || 10,
  };
};

// Validate and export environment configuration
let environment: Environment;

try {
  const rawConfig = getRawConfig();
  environment = environmentSchema.parse(rawConfig);
} catch (error) {
  console.error('Environment configuration validation failed:', error);

  // Provide safe defaults for development
  environment = {
    supabaseUrl: 'http://localhost:54321',
    supabaseAnonKey: 'development-key-placeholder',
    nodeEnv: 'development',
    enableLogging: true,
    enableAuditLogging: true,
    maxRetryAttempts: 3,
    sessionTimeoutMs: 30 * 60 * 1000,
    apiTimeoutMs: 10000,
    maxConcurrentRequests: 10,
  };
}

// Enterprise security validation
const validateSecurityConfiguration = () => {
  const warnings: string[] = [];

  if (environment.nodeEnv === 'production') {
    if (environment.supabaseUrl.includes('localhost')) {
      warnings.push('Production environment using localhost Supabase URL');
    }

    if (environment.supabaseAnonKey.includes('placeholder')) {
      warnings.push('Production environment using placeholder Supabase key');
    }

    if (!environment.enableAuditLogging) {
      warnings.push('Audit logging disabled in production environment');
    }
  }

  if (warnings.length > 0 && environment.enableLogging) {
    console.warn('Security Configuration Warnings:', warnings);
  }
};

// Validate configuration on load
validateSecurityConfiguration();

export default environment;

export type { Environment };

// Configuration utilities
export const isProduction = environment.nodeEnv === 'production';
export const isDevelopment = environment.nodeEnv === 'development';
export const isStaging = environment.nodeEnv === 'staging';

// Security utilities
export const getCorrelationId = () => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return `${timestamp}-${random}`;
};

export const sanitizeForLogging = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];
  const sanitized = { ...data };

  for (const [key, value] of Object.entries(sanitized)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    }
  }

  return sanitized;
};